[hidden] {
  display: none !important;
}

:root {
  --navy: #031126;
  --navy2: #071c38;
  --panel: #0a2446;
  --line: rgba(83, 205, 239, .2);
  --cyan: #35d9f2;
  --blue: #1689ff;
  --white: #f4f9ff;
  --muted: #8ea6c2;
  --danger: #ff6677;
  --success: #56e2a4;
  font-family: Manrope, system-ui, sans-serif;
  color: var(--white);
  background: var(--navy);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(
      circle at 80% 10%,
      rgba(22, 137, 255, .18),
      transparent 32%
    ),
    linear-gradient(
      145deg,
      #020b19,
      #061a35 65%,
      #051329
    );
  color: var(--white);
}

button,
input,
select,
textarea {
  font: inherit;
}

.ambient {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(
      rgba(53, 217, 242, .025) 1px,
      transparent 1px
    ),
    linear-gradient(
      90deg,
      rgba(53, 217, 242, .025) 1px,
      transparent 1px
    );
  background-size: 42px 42px;
}

.login-shell,
.center-state {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.login-card {
  position: relative;
  width: min(460px, 100%);
  padding: 42px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background:
    linear-gradient(
      160deg,
      rgba(12, 40, 76, .96),
      rgba(4, 17, 38, .98)
    );
  box-shadow: 0 30px 90px rgba(0, 0, 0, .45);
  overflow: hidden;
}

.login-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background:
    linear-gradient(
      90deg,
      transparent,
      var(--cyan),
      var(--blue),
      transparent
    );
}

.portal-brand {
  display: flex;
  align-items: center;
  gap: 13px;
}

.portal-brand img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.portal-brand span {
  display: grid;
  letter-spacing: .08em;
}

.portal-brand b {
  font-size: 1.25rem;
}

.portal-brand small {
  font-size: .58rem;
  color: var(--cyan);
}

.eyebrow {
  margin: 30px 0 8px;
  color: var(--cyan);
  font-size: .7rem;
  font-weight: 800;
  letter-spacing: .18em;
}

.login-card h1,
.view h1 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 1.02;
  letter-spacing: -.04em;
}

.login-card h1 em {
  color: var(--cyan);
  font-style: normal;
}

.login-intro,
.section-heading p,
.hero-panel p {
  color: var(--muted);
  line-height: 1.6;
}

.login-card form {
  display: grid;
  gap: 17px;
  margin-top: 28px;
}

label {
  display: grid;
  gap: 7px;
  color: #cbd9e9;
  font-size: .78rem;
  font-weight: 700;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid rgba(142, 166, 194, .3);
  border-radius: 10px;
  background: #06162c;
  color: var(--white);
  padding: 13px 14px;
  outline: none;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--cyan);
  box-shadow: 0 0 0 3px rgba(53, 217, 242, .1);
}

button {
  border: 0;
  cursor: pointer;
}

button:disabled {
  opacity: .55;
  cursor: wait;
}

.primary,
.secondary,
.danger,
.icon-button,
.logout {
  border-radius: 10px;
  padding: 13px 17px;
  font-size: .75rem;
  font-weight: 800;
  letter-spacing: .06em;
}

.primary {
  color: #001425;
  background:
    linear-gradient(
      110deg,
      var(--cyan),
      #3ea4ff
    );
  box-shadow:
    0 8px 28px rgba(30, 171, 235, .2);
}

.secondary {
  color: var(--white);
  background: #102c50;
  border: 1px solid var(--line);
}

.danger {
  color: #fff;
  background: #b93d52;
}

.full {
  width: 100%;
}

.message {
  min-height: 20px;
  color: var(--danger);
  font-size: .78rem;
}

.secure-note {
  display: block;
  text-align: center;
  color: #6f89a8;
  margin-top: 20px;
}

.center-state {
  align-content: center;
  color: var(--muted);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, .12);
  border-top-color: var(--cyan);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.portal {
  min-height: 100vh;
}

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: 270px;
  padding: 26px 20px;
  background: rgba(3, 14, 31, .97);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  z-index: 20;
}

.compact {
  padding: 0 10px 24px;
  border-bottom: 1px solid var(--line);
}

.compact img {
  width: 40px;
  height: 40px;
}

.sidebar nav {
  display: grid;
  gap: 7px;
  margin-top: 28px;
}

.nav-item {
  display: flex;
  gap: 13px;
  align-items: center;
  padding: 13px;
  border-radius: 9px;
  background: transparent;
  color: #9db1c9;
  text-align: left;
}

.nav-item span {
  font-size: .62rem;
  color: #55728f;
}

.nav-item:hover,
.nav-item.active {
  background:
    linear-gradient(
      90deg,
      rgba(24, 137, 255, .2),
      rgba(53, 217, 242, .05)
    );
  color: #fff;
}

.nav-item.active span {
  color: var(--cyan);
}

.session-card {
  display: grid;
  gap: 4px;
  margin-top: auto;
  padding: 15px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #071a34;
}

.session-card small {
  font-size: .58rem;
  color: var(--success);
  letter-spacing: .12em;
}

.session-card b {
  font-size: .8rem;
}

.session-card span {
  font-size: .64rem;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout {
  margin-top: 10px;
  background: transparent;
  color: #9fb1c7;
  border: 1px solid rgba(255, 255, 255, .1);
}

.workspace {
  margin-left: 270px;
  min-height: 100vh;
}

.topbar {
  height: 74px;
  padding: 0 34px;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(4, 19, 41, .72);
  backdrop-filter: blur(12px);
}

.topbar p {
  margin: 0;
  font-size: .68rem;
  letter-spacing: .16em;
  font-weight: 800;
}

.topbar span {
  font-size: .67rem;
  color: var(--muted);
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 10px var(--success);
}

.menu {
  display: none;
  background: transparent;
  color: #fff;
  font-size: 1.2rem;
}

.view {
  display: none;
  padding: 34px;
  max-width: 1500px;
  margin: auto;
}

.view.active {
  display: block;
}

.hero-panel {
  min-height: 235px;
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 38px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background:
    radial-gradient(
      circle at 80%,
      rgba(22, 137, 255, .23),
      transparent 30%
    ),
    linear-gradient(
      120deg,
      #092548,
      #06172e
    );
  overflow: hidden;
}

.hero-panel .eyebrow {
  margin-top: 0;
}

.hero-panel h1 {
  font-size: clamp(2rem, 4vw, 3.25rem);
}

.hero-panel h1 span {
  color: var(--cyan);
}

.shield {
  width: 135px;
  height: 135px;
  border: 1px solid rgba(53, 217, 242, .4);
  border-radius: 30% 30% 45% 45%;
  display: grid;
  place-content: center;
  text-align: center;
  color: var(--cyan);
  font-size: 2rem;
  font-weight: 800;
  box-shadow:
    inset 0 0 40px rgba(53, 217, 242, .08),
    0 0 40px rgba(53, 217, 242, .08);
}

.shield small {
  font-size: .45rem;
  letter-spacing: .12em;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 17px;
  margin: 18px 0;
}

.metrics article,
.section-card,
.data-card,
.export-card {
  border: 1px solid var(--line);
  border-radius: 15px;
  background: rgba(8, 31, 60, .75);
  padding: 23px;
}

.metrics article {
  display: grid;
  gap: 8px;
}

.metrics span {
  color: var(--muted);
  font-size: .65rem;
  font-weight: 800;
  letter-spacing: .11em;
}

.metrics strong {
  font-size: 2.4rem;
}

.metrics small {
  color: #718ca9;
}

.active-text {
  color: var(--success);
  font-size: 1.5rem !important;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}

.section-heading .eyebrow {
  margin: 0 0 7px;
}

.section-heading h1,
.section-heading h2 {
  margin: 0;
}

.section-heading p {
  margin: 7px 0 0;
}

.quick-actions {
  display: flex;
  gap: 12px;
}

.toolbar {
  display: grid;
  grid-template-columns:
    minmax(240px, 1fr)
    220px
    48px;
  gap: 12px;
  margin-bottom: 15px;
}

.search {
  position: relative;
}

.search input {
  padding-left: 14px;
}

.icon-button {
  padding: 0;
  background: #102c50;
  color: #fff;
  border: 1px solid var(--line);
  font-size: 1.2rem;
}

.data-card {
  padding: 0;
  overflow: hidden;
}

.table-wrap {
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid rgba(83, 205, 239, .1);
  font-size: .78rem;
}

th {
  font-size: .62rem;
  color: #7190ae;
  letter-spacing: .08em;
}

td small {
  display: block;
  color: var(--muted);
  margin-top: 3px;
}

.plate {
  font-family: var(--font-mono, monospace);
  font-size: .95rem;
  letter-spacing: .08em;
}

.pill {
  display: inline-block;
  padding: 5px 8px;
  border-radius: 30px;
  font-size: .58rem;
  font-weight: 800;
  letter-spacing: .08em;
}

.pill.on {
  color: var(--success);
  background: rgba(86, 226, 164, .1);
}

.pill.off {
  color: #a6b4c5;
  background: rgba(166, 180, 197, .1);
}

.pill.pending {
  color: #ffd166;
  background: rgba(255, 209, 102, .1);
}

.text-button {
  padding: 5px;
  background: transparent;
  font-size: .66rem;
  font-weight: 800;
}

.danger-text {
  color: var(--danger);
}

.inline-state {
  padding: 28px;
  text-align: center;
  color: var(--muted);
}

.request-grid {
  display: grid;
  grid-template-columns:
    repeat(
      auto-fit,
      minmax(260px, 1fr)
    );
  gap: 16px;
}

.request-card {
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(8, 31, 60, .75);
}

.request-card h3 {
  margin: 16px 0 5px;
}

.request-card p {
  color: var(--muted);
}

.request-card dl {
  display: grid;
  gap: 8px;
}

.request-card dl div,
#requestDetails div {
  display: flex;
  justify-content: space-between;
  gap: 15px;
}

.request-card dt,
#requestDetails dt {
  color: var(--muted);
  font-size: .72rem;
}

.request-card dd,
#requestDetails dd {
  margin: 0;
  text-align: right;
  font-size: .74rem;
}

.request-card button {
  width: 100%;
  margin-top: 13px;
}

.export-card {
  display: flex;
  gap: 30px;
  align-items: center;
  max-width: 760px;
}

.export-symbol {
  width: 120px;
  height: 140px;
  border-radius: 14px;
  display: grid;
  place-content: center;
  border: 1px solid var(--line);
  background:
    linear-gradient(
      145deg,
      #0e3565,
      #071a35
    );
  font-size: 1.5rem;
  color: var(--cyan);
  font-weight: 800;
}

.export-card > div:last-child {
  flex: 1;
}

.export-card label {
  max-width: 220px;
  margin: 18px 0;
}

.notice {
  position: fixed;
  right: 25px;
  top: 90px;
  z-index: 50;
  max-width: 400px;
  padding: 14px 18px;
  border-radius: 10px;
  background: #123b3a;
  border: 1px solid rgba(86, 226, 164, .4);
  box-shadow: 0 15px 45px rgba(0, 0, 0, .35);
  font-size: .8rem;
}

.notice.error {
  background: #45212c;
  border-color: rgba(255, 102, 119, .5);
}

dialog {
  width: min(
    680px,
    calc(100% - 24px)
  );
  padding: 0;
  border: 0;
  border-radius: 18px;
  background: transparent;
  color: var(--white);
}

dialog::backdrop {
  background: rgba(0, 7, 17, .78);
  backdrop-filter: blur(6px);
}

.modal-card {
  position: relative;
  padding: 30px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: #081d39;
  box-shadow: 0 30px 90px rgba(0, 0, 0, .5);
}

.modal-card .eyebrow {
  margin-top: 0;
}

.modal-card h2 {
  margin-top: 0;
}

.modal-close {
  position: absolute;
  right: 15px;
  top: 12px;
  background: transparent;
  color: #8da3bc;
  font-size: 1.8rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.form-note {
  color: var(--muted);
  font-size: .75rem;
}

.decision-actions {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}

.decision-actions button {
  flex: 1;
}

#requestDetails {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 10px;
}

.modal-card textarea {
  min-height: 90px;
  resize: vertical;
}

@media (max-width: 900px) {

  .sidebar {
    transform: translateX(-100%);
    transition: .25s;
  }

  .sidebar.open {
    transform: none;
  }

  .workspace {
    margin-left: 0;
  }

  .menu {
    display: block;
  }

  .topbar {
    padding: 0 18px;
  }

  .view {
    padding: 22px;
  }

  .metrics {
    grid-template-columns: 1fr;
  }

  .hero-panel {
    padding: 28px;
  }

  .shield {
    display: none;
  }

  .section-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .toolbar {
    grid-template-columns:
      1fr
      1fr
      48px;
  }
}

@media (max-width: 650px) {

  .login-card {
    padding: 28px 22px;
  }

  .view {
    padding: 16px;
  }

  .topbar .status {
    display: none;
  }

  .hero-panel {
    min-height: 210px;
    padding: 24px;
  }

  .hero-panel h1 {
    font-size: 2rem;
  }

  .quick-actions,
  .decision-actions {
    display: grid;
  }

  .toolbar {
    grid-template-columns:
      1fr
      48px;
  }

  .toolbar select {
    grid-column: 1;
  }

  .toolbar .icon-button {
    grid-column: 2;
    grid-row: 1 / 3;
  }

  .data-card {
    background: transparent;
    border: 0;
  }

  .table-wrap {
    overflow: visible;
  }

  table thead {
    display: none;
  }

  table,
  tbody,
  tr,
  td {
    display: block;
  }

  tr {
    margin-bottom: 12px;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: rgba(8, 31, 60, .8);
  }

  td {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    padding: 9px 0;
    border: 0;
    text-align: right;
  }

  td::before {
    content: attr(data-label);
    color: #718ca9;
    font-size: .65rem;
    font-weight: 800;
    text-align: left;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .export-card {
    align-items: flex-start;
  }

  .export-symbol {
    width: 76px;
    height: 90px;
  }

  .section-heading > .primary {
    width: 100%;
  }
}
