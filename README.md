# Logo Lapser - Web App

Eine Web-App zum automatischen Ausrichten von Logos und Bildern mit KI-Unterstützung.

## Features

- **Automatische Logo-Ausrichtung**: Nutzt Computer Vision (OpenCV) für präzise Bildausrichtung
- **Golden Template Refinement**: Verfeinert die Ausrichtung mit KI-Technologie
- **Projekt-Management**: Speichern und Laden von Projekten über Supabase
- **Multi-Image Support**: Batch-Verarbeitung mehrerer Bilder
- **Debug-Modus**: Visualisierung der Ausrichtungsschritte
- **Greedy Mode**: Schnellere Verarbeitung für einfache Fälle

## Nutzung

1. **Bilder hochladen**: Ziehe PNG oder JPEG Dateien in die Dropzone
2. **Master-Bild auswählen**: Wähle das Referenzbild (Master) aus
3. **Einstellungen anpassen**: Aktiviere/Deaktiviere Refinement, Ensemble Correction etc.
4. **Verarbeitung starten**: Klicke auf "Go! Align Images"
5. **Ergebnisse exportieren**: Lade alle ausgerichteten Bilder als ZIP herunter

## Projekt-Management

- **Projekt speichern**: Klicke auf "Projekte" → "Aktuelles Projekt speichern"
- **Projekt laden**: Wähle ein gespeichertes Projekt aus der Liste und klicke auf "Laden"
- **Projekt löschen**: Entferne nicht mehr benötigte Projekte

## Technologie-Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Computer Vision**: OpenCV.js
- **KI-Verfeinerung**: Google Generative AI
- **Backend/Storage**: Supabase
- **Build**: Vite

## Deployment

Die App ist als statische Web-App gebaut und kann auf jedem Hosting-Service deployed werden:

```bash
npm run build
npm run preview
```

Für Produktions-Deployments:
- Kopiere den `dist/` Ordner auf deinen Webserver
- Oder nutze Vercel, Netlify, GitHub Pages etc.

## Environment Variablen

Erstelle eine `.env.local` Datei mit:

```
VITE_SUPABASE_URL=deine_supabase_url
VITE_SUPABASE_ANON_KEY=dein_supabase_anon_key
```

## Supabase Setup

1. Neues Supabase Projekt erstellen
2. Das SQL Schema aus `supabase-schema.sql` ausführen
3. Projekt-URL und Anon-Key in `.env.local` eintragen

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Die App läuft dann auf `http://localhost:5173`

## Live Demo

Die App ist jetzt verfügbar unter: http://192.168.178.81:3000/
