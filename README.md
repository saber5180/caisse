# 💰 Caisse Chauffeurs — Gestion & Recettes Web

Application web moderne Next.js 14 pour la gestion de caisse, l'encaissement des tournées chauffeurs, le comptage billetterie et le suivi des règlements, calquée sur le classeur Excel `TABLEAU_SCALCULE_CAISSE_HICHEJ.xlsm`.

## ✨ Fonctionnalités Clés

- 💵 **Guichet de Caisse Interactif (`/caisse`)** :
  - Décompte par coupures pour les entrées et sorties de caisse.
  - Calcul dynamique en temps réel : $\text{T. PAYER} - \text{RECETTE} = \text{RES. A PAYER}$.
  - Coloration réactive : **Vert** (excédent), **Rouge** (déficit), **Blanc** (équilibre).
  - Scanner code-barres / Code TR en continu.
  - Raccourcis clavier : Touche **V** (Valider), Touche **P** (Imprimer), Touche **R** (Nettoyer).
- 🪙 **Comptage Billetterie & Coffre (`/billetterie`)** :
  - Dénombrement physique des 12 coupures (pièces 0.050 à 5 TND, billets 5 à 50 TND).
  - Calcul automatique du Fonds de Roulement (`SRF`), Versements (`VER`), et Total Physique (`TT`).
  - Rapprochement direct avec la recette théorique et calcul du `RESTE`.
- 🚚 **Mouvement des Chauffeurs (`/chauffeurs`)** :
  - Suivi des 70 chauffeurs pré-chargés depuis votre fichier Excel.
  - Alertes d'ancienneté calculées en temps réel (`ALERTE NON PAYE CAISSE <CIRCUIT> DEPUIS X JOURS`).
  - Changement de statut instantané (`NON PAYÉ`, `PAYÉ`, `PAS DE CAISSE`).
  - Recherche rapide par nom, code TR ou circuit.
- ⏰ **Programme des Tournées & Bascule 12:30 (`/programme`)** :
  - Affectation des circuits de livraison.
  - Bouton **"Bascule de 12:30"** (Macro Excel "A") : bascule automatique des tournées du matin non réglées en dette formelle.
- 📑 **Journal des Transactions (`/journal`)** :
  - Historique de tous les encaissements archivés avec export Excel `.xlsx`.
- 📊 **Import / Export Excel (`/excel`)** :
  - Mettre à jour les données à partir d'un fichier `.xlsm` ou `.xlsx`.

---

## 🚀 Démarrage Rapide

### 1. Aller dans le dossier du projet :
```bash
cd "C:\Users\Saber ben Slama\Desktop\hichem\caisse-chauffeur-web"
```

### 2. Installer les dépendances :
```bash
npm install
```

### 3. Lancer le serveur de développement :
```bash
npm run dev
```

L'application sera accessible sur :
👉 **http://localhost:3001** *(port 3001 pour ne pas entrer en conflit avec recouvrement-web sur le port 3000)*.

---

## 🎨 Technologies Utilisées

- **Next.js 14** (App Router)
- **TypeScript** (Typage statique strict)
- **Tailwind CSS** (Design system moderne avec composants personnalisés)
- **Zustand** (Store réactif avec persistance locale automatique)
- **SheetJS (xlsx)** (Lecture et génération de fichiers Excel)
- **date-fns** (Calculs précis de durées et d'anciennetés)

