# Render non ha un runtime Java 25 pronto: si costruisce l'immagine, cosi' la versione del JDK la
# decidiamo noi ed e' la stessa che gira sul portatile (progettazione, sezione 12.5).
#
# IMPORTANTE: il contesto di build e' la RADICE del repository, non Resonance_BE, perche'
# l'immagine legge anche Resonance_FE. Da qui:
#   docker build -f Resonance_BE/Dockerfile -t resonance .
#
# Un solo servizio per API e frontend (decisione 1): lo stage Node costruisce il frontend e lo
# stage JDK ne copia dist/ in src/main/resources/static/, da dove Spring lo serve (decisione 74).

# --- Fase 1: frontend ---------------------------------------------------------
# Node 24 LTS, la stessa versione dello sviluppo. Prima solo i file del lock: finche' le
# dipendenze non cambiano, Render riusa lo strato di npm ci dalla cache.
FROM node:24-alpine AS frontend
WORKDIR /fe
COPY Resonance_FE/package.json Resonance_FE/package-lock.json ./
RUN npm ci

COPY Resonance_FE/ ./
RUN npm run build

# --- Fase 2: compilazione -----------------------------------------------------
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app

# Prima solo il wrapper e il pom: finche' le dipendenze non cambiano, Render riusa questo
# strato dalla cache e la build dura pochi secondi.
COPY Resonance_BE/.mvn/ .mvn/
COPY Resonance_BE/mvnw Resonance_BE/pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -ntp dependency:go-offline

COPY Resonance_BE/src/ src/
# Il frontend compilato va in static/ prima del package: finisce dentro il jar (progettazione, sezione 12.5).
COPY --from=frontend /fe/dist/ src/main/resources/static/
RUN ./mvnw -B -ntp -DskipTests package

# --- Fase 3: esecuzione -------------------------------------------------------
# Solo il JRE e il jar: l'immagine finale non si porta dietro Maven ne' i sorgenti.
FROM eclipse-temurin:25-jre
WORKDIR /app

# Utente senza privilegi: il processo non gira come root. Porta 8080 o PORT di Render (> 1024),
# quindi non servono permessi speciali.
RUN groupadd --system app && useradd --system --gid app --no-create-home app
COPY --from=build --chown=app:app /app/target/*.jar app.jar
USER app

# 8080 e' il valore di riserva: in produzione la porta la impone Render con PORT.
EXPOSE 8080

# MaxRAMPercentage: il piano free di Render ha 512 MB e la JVM usa memoria anche fuori
# dall'heap (metaspace, thread, buffer); con il 60% resta margine per non andare in OOM.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=60", "-jar", "/app/app.jar"]
