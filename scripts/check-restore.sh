#!/usr/bin/env bash
# Controlla che un file ripristinato dopo una prova di sicurezza coincida con l'ultima versione committata.
# Uso: bash scripts/check-restore.sh <percorso-del-file>
# Esce con 1 se il file differisce da HEAD (o non e' tracciato); stampa sempre l'md5 del file.

if [ -z "$1" ]; then
    echo "Uso: $0 <percorso-del-file>" >&2
    exit 2
fi

file="$1"

# md5: md5sum su Linux e Git Bash, md5 -q su macOS.
if command -v md5sum >/dev/null 2>&1; then
    hash=$(md5sum "$file" | cut -d' ' -f1)
else
    hash=$(md5 -q "$file")
fi

# Su Windows il file di lavoro puo' avere fine riga CRLF mentre git show restituisce LF (autocrlf):
# si confrontano i contenuti senza i CR, cosi' conta solo il testo.
if git show HEAD:"$file" 2>/dev/null | tr -d '\r' | cmp -s - <(tr -d '\r' < "$file"); then
    echo "cmp: OK"
    status=0
else
    echo "cmp: DIFFERENZE TROVATE"
    status=1
fi

echo "md5: $hash"
exit $status
