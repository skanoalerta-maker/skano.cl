"""Despliegue LIMITADO de Firebase Hosting de skano-judicial-prd.

Toma la versión publicada, la clona (archivos y configuración) y reemplaza
solo los archivos indicados. Así no se vuelve a subir el sitio completo.

  python3 hosting_parcial.py plan       solo lectura: muestra qué cambia
  python3 hosting_parcial.py publicar   clona, sube los cambios y publica
  python3 hosting_parcial.py revertir <version>   vuelve a una versión anterior

Los archivos vienen del commit 68a1c62 (build de 7047655) del repositorio público
skanoalerta-maker/skano.cl (rama temporal deploy/judicial-acceso-clave) y se
verifican con SHA-256 antes de usarlos.
"""
import gzip, hashlib, json, subprocess, sys, time, urllib.request, urllib.error

SITE = "skano-judicial-prd"
API = "https://firebasehosting.googleapis.com/v1beta1/"
RAW = "https://raw.githubusercontent.com/skanoalerta-maker/skano.cl/68a1c620f0701df17a8dd697f5839a63b9158e88/judicial_hosting/"
FILES = {
    "admin/admin-core.mjs": "c3d814cfce93863d7b9fac8279cb626099d7787b34c73348cefc7f14e6573ec9",
    "admin/admin.css": "9b9ba56c4360ac30af383f70a29430c6eaa6b9a2abc90547e3e378d378f346fe",
    "admin/admin.js": "b145884ac19d215b9c7f70123caba76fd9034a7453b07068710996117cb39792",
    "admin/index.html": "6f370ec3d9fbbf7cfe88cdd67efcd0a700e8a49dfb730fa009abc35c81db8ea4",
    "judicial-env.mjs": "33491f4e7c1293eb115b61943bef8b38ed5229e1da2b6e9846b0086d3cd5e2aa",
    "judicial-firebase.mjs": "af7c981344d57ff6ec3f0b48d67f68bbc040689784c44231171bac000c976644",
    "portal/index.html": "7cd1c6fa195ee3dc77cc84761b663562f55b810dcdcf37f6685539dacfb62e2e",
    "portal/invitacion/index.html": "e24c8cd13cf91803653fe214766f18505aaf8f32c6c9f12a1d396acb9dd27720",
    "portal/invitacion/redirect.js": "22f15a5b2fb53e3ed223618a8b0342a45e2f4618a12158af4ac3880b748ffef3",
    "portal/portal-core.mjs": "7ee70a6d4c2bc70320fde8bcedcd87557bcc4bb0189655669649d08d5aec4203",
    "portal/portal.css": "37e4abb0c19a34f683fbf90247ad37ed46095e68f0f012ec74efd18cac32dba5",
    "portal/portal.js": "0f9e3e72a5411cd774c07fb68cd959783a64ce15b7862524ab22a8a4da6b023f",
    "qr.mjs": "81ee44216b73416604b42dcb1c2d39be097732c8bcbe0e8a4c4e5ee42e221545",
}

TOKEN = subprocess.check_output(["gcloud", "auth", "print-access-token"]).decode().strip()

def call(method, url, body=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url if url.startswith("http") else API + url, data=data, method=method,
                                 headers={"Authorization": "Bearer " + TOKEN, "x-goog-user-project": SITE, "Content-Type": ctype})
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read()
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"ERROR {e.code} en {method} {url}: {e.read().decode()[:300]}")

def download():
    out = {}
    for path, sha in FILES.items():
        with urllib.request.urlopen(RAW + path) as r:
            data = r.read()
        if hashlib.sha256(data).hexdigest() != sha:
            sys.exit(f"ERROR: {path} no coincide con el SHA-256 esperado. No se publica nada.")
        gz = gzip.compress(data, mtime=0)
        out["/" + path] = (gz, hashlib.sha256(gz).hexdigest(), data)
    return out

def live_version():
    ch = call("GET", f"sites/{SITE}/channels/live")
    return ch["release"]["version"]

def version_files(name):
    files, token = {}, ""
    while True:
        r = call("GET", f"{name}/files?pageSize=1000" + (f"&pageToken={token}" if token else ""))
        for f in r.get("files", []):
            files[f["path"]] = f["hash"]
        token = r.get("nextPageToken")
        if not token:
            return files

def plan(local, live):
    current = version_files(live["name"])
    changed = []
    for path, (_, _, data) in local.items():
        live_hash = current.get(path)
        # El hash publicado es del contenido comprimido; se compara el contenido real.
        same = False
        if live_hash:
            try:
                with urllib.request.urlopen(f"https://{SITE}.web.app{path}?nocache={int(time.time())}") as r:
                    same = r.read() == data
            except Exception:
                same = False
        if not same:
            changed.append(path)
    print("VERSION_PUBLICADA", live["name"].split("/")[-1], "creada", live.get("createTime", "")[:19])
    print("ARCHIVOS_PUBLICADOS", len(current))
    for p in local:
        print(("  CAMBIA  " if p in changed else "  igual   ") + p + ("  (nuevo)" if p not in current else ""))
    return changed, current

def wait_op(op):
    for _ in range(120):
        r = call("GET", "https://firebasehosting.googleapis.com/v1beta1/" + op["name"])
        if r.get("done"):
            if "error" in r:
                sys.exit("ERROR al clonar: " + json.dumps(r["error"])[:300])
            return r["response"]
        time.sleep(2)
    sys.exit("ERROR: la clonación no terminó a tiempo.")

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "plan"
    if mode == "revertir":
        target = sys.argv[2]
        rel = call("POST", f"sites/{SITE}/releases?versionName=sites/{SITE}/versions/{target}", {"message": "Reversión SKANO Judicial"})
        print("REVERTIDO a", target, rel.get("name", ""))
        return
    local = download()
    live = live_version()
    changed, _ = plan(local, live)
    if mode != "publicar":
        print("PLAN_OK (no se modificó nada)")
        return
    if not changed:
        print("Nada que publicar.")
        return
    new = wait_op(call("POST", f"sites/{SITE}/versions:clone", {"sourceVersion": live["name"], "finalize": False}))
    name = new["name"]
    if json.dumps(new.get("config", {}), sort_keys=True) != json.dumps(live.get("config", {}), sort_keys=True):
        call("PATCH", f"{name}?updateMask=config", {"config": live.get("config", {})})
    pop = call("POST", f"{name}:populateFiles", {"files": {p: local[p][1] for p in changed}})
    need = set(pop.get("uploadRequiredHashes", []))
    for p in changed:
        gz, h, _ = local[p]
        if h in need:
            call("POST", f"{pop['uploadUrl']}/{h}", raw=gz, ctype="application/octet-stream")
    call("PATCH", f"{name}?updateMask=status", {"status": "FINALIZED"})
    rel = call("POST", f"sites/{SITE}/releases?versionName={name}", {"message": "SKANO Judicial: clave temporal y eliminar usuario (7047655)"})
    print("PUBLICADO", name.split("/")[-1], "| anterior:", live["name"].split("/")[-1], "| archivos:", len(changed))
    for p in changed:
        with urllib.request.urlopen(f"https://{SITE}.web.app{p}?nocache={int(time.time())}") as r:
            ok = r.read() == local[p][2]
        print("  VERIFICADO" if ok else "  DIFERENTE", p)

main()
