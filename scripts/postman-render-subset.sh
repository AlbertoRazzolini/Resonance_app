#!/bin/bash
# Prova leggera dopo il merge su main: richieste della collection senza credenziali e senza scritture
# (nessun login, nessun dato creato). Uso: scripts/postman-render-subset.sh [render|local]  (default: render)
# Prerequisito: Postman CLI. Con "local" il backend deve girare su localhost:8080.
set -u
ROOT=$(cd "$(dirname "$0")/.." && pwd)
TARGET=${1:-render}
COL=$(cygpath -m "$ROOT/postman/resonance.postman_collection.json" 2>/dev/null || echo "$ROOT/postman/resonance.postman_collection.json")
ENVF=$(cygpath -m "$ROOT/postman/resonance-$TARGET.postman_environment.json" 2>/dev/null || echo "$ROOT/postman/resonance-$TARGET.postman_environment.json")
REQS=(
  "Health check (200)" "Percorso inesistente (404)"
  "Register con email non valida (400)" "Resend code senza email (400)" "Forgot password senza email (400)"
  "Refresh senza header (403)" "Logout senza header (403)"
  "Me senza token (401)" "Ricerca utenti senza token (401)" "Attiva un ruolo senza token (401)"
  "Concerti vicini (200)" "Concerti vicini senza lat (400)" "Dettaglio concerto inesistente (404)"
  "I miei indie event senza token (401)" "Indie event vicini (200)" "Indie event vicini senza lat (400)"
  "Lista annunci aperti (200)" "Dettaglio annuncio inesistente (404)"
  "Crea post senza login (401)" "Lista feed (200)" "Lista feed entro il raggio (200)"
  "Lista feed con filtro incompleto (400)" "Dettaglio post inesistente (404)"
  "Metti like senza login (401)" "Togli like senza login (401)"
  "Elenco conversazioni senza token (401)"
)
ARGS=(); for r in "${REQS[@]}"; do ARGS+=(-i "$r"); done
MSYS_NO_PATHCONV=1 postman collection run "$COL" -e "$ENVF" "${ARGS[@]}"
