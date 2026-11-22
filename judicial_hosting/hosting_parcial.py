"""Despliegue LIMITADO de Firebase Hosting de skano-judicial-prd.

Toma la versión publicada, la clona (archivos y configuración) y reemplaza
solo los archivos indicados. Así no se vuelve a subir el sitio completo.

  python3 hosting_parcial.py plan       solo lectura: muestra qué cambia
  python3 hosting_parcial.py publicar   clona, sube los cambios y publica
  python3 hosting_parcial.py revertir <version>   vuelve a una versión anterior

Los archivos vienen del commit b355c6a del repositorio público
skanoalerta-maker/skano.cl (rama temporal deploy/judicial-hosting-totp) y se
verifican con SHA-256 antes de usarlos.
"""
import gzip, hashlib, json, subprocess, sys, time, urllib.request, urllib.error

SITE = "skano-judicial-prd"
API = "https://firebasehosting.googleapis.com/v1beta1/"
RAW = "https://raw.githubusercontent.com/skanoalerta-maker/skano.cl/b355c6aa6da954b4db641ff62341657ad122d723/judicial_hosting/"
FILES = {
    "admin/admin-core.mjs": "dadfd58618b2a5630a8e109127b3763d7a4dc523d36082db8763671681f0e788",
    "admin/admin.css": "feb28a2531a58666956e532db8e1136edc7f367c2a788036806abef200bed901",
    "admin/admin.js": "7f218588076f2c0cac1804abc889e015def209dd455b835aaa13973a523eba83",
    "admin/index.html": "d163b2c67cf445e8e227b701f512e976115f8a8780b1b8f05ab2f84a173ba701",
    "judicial-env.mjs": "b9d4f4f08d1d5e97309822c4e7a528ed6e24d3447accae58c465497044f1daa2",
    "judicial-firebase.mjs": "1bf9e81bbe9bfe8acf5b6ac40c93e2f1c643d82d9da97cb0c7987228f5b17326",
    "qr.mjs": "81ee44216b73416604b42dcb1c2d39be097732c8bcbe0e8a4c4e5ee42e221545",
    "portal/index.html": "f14ab3e660c387384192c30661c1d034a25382e2d728ed73f61a693626e1ba61",
    "portal/portal-core.mjs": "f65dba7e6309652462d58a4a749ef8459d44bf8b2901e36b21d64f2b8f2c92cf",
    "portal/portal.js": "a0c22b2ceb964fe921cdcd110c27a0f42eed4122346206010eabc9bec3f32f4e",
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
    rel = call("POST", f"sites/{SITE}/releases?versionName={name}", {"message": "SKANO Judicial: TOTP con QR (f760b2d), solo archivos afectados"})
    print("PUBLICADO", name.split("/")[-1], "| anterior:", live["name"].split("/")[-1], "| archivos:", len(changed))
    for p in changed:
        with urllib.request.urlopen(f"https://{SITE}.web.app{p}?nocache={int(time.time())}") as r:
            ok = r.read() == local[p][2]
        print("  VERIFICADO" if ok else "  DIFERENTE", p)

main()
