# PERSONAL OS — Guide de conception & développement

> **Positionnement** : *Turn your vision into daily action.*
> **Ce n'est pas un habit tracker.** C'est un système personnel qui traduit une vision long terme en exécution quotidienne mesurable.
> **Utilisateurs initiaux** : Ryan et Grace (2 comptes séparés, données privées par défaut, couche couple opt-in).
> **Architecture** : multi-utilisateur dès le départ. Ryan et Grace ne sont **jamais** codés en dur.

---

## 0. État du projet

| | |
|---|---|
| Milestones | **M0, M2, M3, M4, M5, M6, M7 : faits** (17/08/2026) · **Bilan mensuel à trois couches** (19/08/2026) |
| Reste | M1 (suite d'autorisation en CI), M8 (couple), M9 (revue hebdo + analytics avancées), M10 (polish) |
| Vérifications | `typecheck` ✅ · `test` ✅ 194 tests · `build` ✅ 15 routes · `dev` ✅ · `lint` ⚠️ voir ci-dessous |
| Décisions ouvertes | §14 — codées sur les valeurs par défaut recommandées, à confirmer |

**Fait** : `src/lib/domain/` complet (planning versionné, scoring, streaks avec joker,
objectifs dérivés des habitudes), l'onboarding en 5 étapes avec reprise persistée, la vision
par domaine de vie et le vision board, puis Today, Calendrier, Habitudes, Objectifs, Dashboard,
Analytics, Réglages.

**Partage** (`src/lib/share/`) — deux mécanismes, un seul constructeur de payload
(`build.ts`, pour qu'il n'existe pas deux chemins divergents sur ce qui sort de l'appareil) :

| | Lien vivant `/live/[id]#k=…` | Lien figé `/shared#s=…` |
|---|---|---|
| Données | sur Supabase | dans l'URL |
| Mise à jour | oui, tant que l'app est ouverte | jamais |
| Révocable | oui, contenu effacé | non |
| Serveur requis | oui | non |

**Modèle de sécurité du lien vivant : jeton-capacité, sans comptes.** Secret de 32 octets dans
le fragment ; la base ne stocke que son SHA-256. RLS activée **sans aucune policy** : la table
est inaccessible en direct, y compris à la clé anon. Trois fonctions `security definer` sont les
seules portes, et toutes exigent le secret. Migration : `supabase/migrations/0010_shared_boards.sql`.

Conséquences à ne pas masquer à l'utilisateur : le lien n'est pas chiffré (qui l'a, le lit) ;
le rafraîchissement est un **sondage** de 20 s, pas du Realtime — diffuser en Realtime
supposerait d'exposer la table à anon, ce que ce modèle refuse ; et la source de vérité étant
le navigateur de l'émetteur, **le lien ne se met pas à jour appareil éteint**. Cette dernière
limite disparaît à M1, quand les données vivront côté serveur.

Rien de tout ça ne remplace le système couple du §19 : pas d'identité, pas de réciprocité, pas
d'objectifs partagés. Les pages destinataires (`/shared`, `/live/[id]`) sont volontairement
**hors du groupe `(app)`** : le visiteur n'a pas de profil et l'`AppGate` le renverrait dans
l'onboarding.

**Bilan mensuel — trois couches** (`src/lib/domain/metrics.ts`, `scorecard.ts`, `diagnose.ts`,
`reviews.ts`). Le bilan ne mesure pas une chose, il en mesure trois, **jamais moyennées entre
elles** :

| Couche | Répond à | Source | Calcul |
|---|---|---|---|
| **Fondation** | ce que j'ai fait | `habit_logs` | `consistency()` — Σ num / Σ dénom |
| **Exécution** | ce que j'ai produit | `metric_entries` `kind = output` | moyenne pondérée de ratios |
| **Impact** | ce que ça a généré | `metric_entries` `kind = result` | idem |

⚠️ **L'exécution et l'impact n'utilisent PAS la formule de la consistance.** `consistency` somme
des occurrences commensurables ; les métriques ne le sont pas. Sur `{20 contenus, 300 000 FCFA}`,
un `Σ min(réalisé, cible) / Σ cible` donnerait un dénominateur de 300 020 et le chiffre d'affaires
écraserait tout. L'agrégation est donc une moyenne pondérée de ratios individuels — la forme de
`dailyScore`, où chaque métrique compte pour une métrique quelle que soit son unité. Un test
verrouille ce point précis.

**Une `Metric` n'est ni une habitude ni un objectif.** `MetricKind` n'a délibérément pas de valeur
`habit` : ce qui relève des habitudes se calcule depuis les logs, et **aucun écran ne permet de
ressaisir « Prière = 25 »**. Ce qui la distingue d'un objectif est la **récurrence** : une cible
qui se repose chaque mois est une métrique, un engagement daté unique est un objectif. Les deux se
relient par `Goal.source = 'metric'`, qui dérive sa valeur des entrées au lieu de la stocker.

Quatre états valent `null` et jamais `0` : pas d'entrée (hors contrat du mois), pas de cible
(métrique d'observation), pas de valeur saisie, direction `maintain`. Vider un champ écrit `null` :
« je n'ai pas relevé » n'est pas « j'ai fait zéro ».

**Le mois en cours ne se diagnostique pas** (`diagnose.ts`) : le 10 du mois, une production à 25 %
est un mois à 30 % d'avancement, pas un retard. Les hypothèses croisées entre couches sont donc
suspendues tant que le mois n'est pas terminé, et aucune observation n'affirme jamais une cause —
« explication possible », jamais « tu as ». Le ton est tenu par des tests.

**La revue de fin de mois** vit au bas du bilan, pas dans un écran séparé : on répond mieux à
« qu'est-ce qui n'a pas marché » avec les chiffres sous les yeux. Une fois clôturée, elle **gèle**
ses chiffres — relire mars avec les statistiques recalculées d'aujourd'hui n'aurait aucun sens
rétrospectif. Rouvrir jette le gel : deux vérités pour un même mois, jamais.

**Format du state versionné** : `AppState.version` + `migrate()` dans `src/lib/store/state.ts`.
Tout changement de forme incrémente `STATE_VERSION` et **complète** l'ancien état — on ne jette
jamais les données de quelqu'un qui suit ses habitudes depuis des semaines. Couvert par
`state.test.ts`.

**Schéma vérifié contre un vrai projet (17/08/2026).** Les 11 migrations s'appliquent, les
fonctions PL/pgSQL répondent (`daily_score` renvoie bien `null` sur un jour neutre), et le cycle
complet du lien vivant est validé : création, lecture avec le bon secret, `[]` avec un mauvais,
révocation, puis `[]` définitif.

**Isolation entre comptes vérifiée (19/08/2026)** — la passe qui compte, avec deux comptes réels
et leurs propres jetons, jamais la clé `service_role` :

| Chemin tenté par le compte B sur les données de A | Résultat |
|---|---|
| `user_state` sans filtre · trié · `count` | uniquement la ligne de B |
| `user_state?user_id=eq.<A>` · filtre `neq` | `[]` |
| `profiles`, `habits`, `goals`, `habit_logs`, `reviews`, `vision_*` | `[]` |
| Jointure imbriquée `profiles?select=id,habits(...)` | `[]` |
| `INSERT` d'une ligne au nom de A | **HTTP 403**, refusé par la policy |
| `UPDATE` / `DELETE` sur la ligne de A | `[]` — aucune ligne touchée |

Contrôle inverse : chacun lit bien ses propres données, et la ligne de A est ressortie intacte.
Côté application, deux sessions dans le même navigateur ont **deux miroirs locaux distincts**
(clé suffixée par l'identifiant), donc rien ne fuit non plus par `localStorage`.

⚠️ Ce test est **manuel**, pas en CI. Le §11 demande une suite d'autorisation qui tourne à chaque
commit ; elle reste à écrire.

**Deux comptes existent** (19/08/2026). `supabase/seed.sql` n'a toujours pas été exécuté et ne
doit pas l'être sur un projet hébergé : ses mots de passe sont dans un dépôt public. Créer les
comptes depuis le dashboard, avec **Auto Confirm User coché** (le projet a
`mailer_autoconfirm = false`, donc un compte non confirmé ne peut pas se connecter).

**Chaîne live vérifiée de bout en bout (19/08/2026)** : connexion → profil créé par le
déclencheur → lecture `user_state` → onboarding → écriture `201` → **reconnexion depuis un
navigateur vierge qui retrouve les données côté serveur**. Un document `v6` en base a été migré
en `v7` et réécrit sans perte. À savoir : la première connexion prend six à neuf secondes en dev,
sans aucun retour visuel au-delà du libellé « Connexion… » — ça ressemble à une panne.

**Migrations 0015 à 0017 non appliquées** sur le projet hébergé. Sans conséquence tant que la
persistance passe par `user_state`, mais l'écart entre le dépôt et la base se creuse.

**Authentification** (`src/lib/auth/`) — Supabase Auth, **optionnelle** : sans variables
d'environnement, l'application tourne en mode local sans écran de connexion. `SessionShell`
aiguille les trois cas (non configuré / non connecté / connecté). Comptes initiaux créés par
`supabase/seed.sql`, mots de passe à changer à la première connexion via Réglages → Compte.

**Persistance.** Connecté → table `user_state` (JSONB) sur Postgres, protégée par la même RLS
stricte que le reste. Non connecté → `localStorage` seul. Dans les deux cas derrière l'interface
`Repository`, et les écritures sont **temporisées à 700 ms** avec vidage forcé sur `pagehide` et
passage en arrière-plan : sans ça, chaque frappe déclencherait une requête réseau.

Un **miroir local** double systématiquement l'écriture serveur. Si le réseau tombe, l'application
repart du dernier état connu au lieu de présenter un espace vide — ce qui relancerait l'onboarding
et donnerait l'impression que tout est perdu.

**⚠️ Écart assumé — document plutôt que schéma normalisé.** `user_state` stocke l'`AppState`
entier en JSONB (migration `0012`), alors que les tables de `0003` à `0006` sont la vraie cible.
Raison : l'interface `Repository` écrit l'état comme un tout, et synchroniser ça vers dix tables
normalisées demanderait un moteur de diff dont chaque bug se paierait en données perdues.

Conséquence à ne pas oublier : **l'espace couple ne peut pas fonctionner tant que les données
vivent là** — `get_couple_overview` et le scoring SQL agrègent depuis les tables normalisées. La
migration se fera écran par écran, sans nouvelle rupture pour l'utilisateur.

**RLS vérifiée (17/08/2026)** : une écriture anonyme sur `user_state` est refusée
(`42501 new row violates row-level security policy`). Premier contrôle réel — les vérifications
précédentes passaient par la clé `service_role`, qui contourne les policies.

**Dette environnement connue** : le cache npm de la machine produit des extractions partielles
(`vitest`, `rolldown`, `enhanced-resolve`, `eslint`, `ajv` ont dû être réinstallés un par un).
`npm run lint` reste cassé pour cette raison, pas à cause du code. Correctif :
`npm cache clean --force && rm -rf node_modules package-lock.json && npm install`.

Mettre ce tableau à jour à chaque fin de milestone.

---

## 1. Philosophie produit

La boucle fondamentale, à respecter dans les données comme dans l'UI :

```
VISION → GOALS → HABITS → EXÉCUTION QUOTIDIENNE → REVIEW → AMÉLIORATION
```

### Les trois paris du produit

**1. Goals et Habits sont reliés dans les données, pas juste côte à côte dans l'UI.**
Un objectif mesurable peut être alimenté **automatiquement** par les logs de ses habitudes liées (`goals.source = 'habit_count' | 'habit_sum'`). Sans ça, on a deux trackers indépendants, pas un système. C'est le différenciateur central.

**2. Le score doit être honnête, sinon le produit meurt.**
Toute la valeur perçue après 6 mois tient dans « est-ce que ce 84% veut dire quelque chose ? ». Un score qui bouge quand on modifie une habitude, une série cassée par un jour non planifié, une moyenne de moyennes → l'utilisateur cesse d'y croire et arrête d'ouvrir l'app. La logique de calcul (§5) prime sur l'UI.

**3. Ryan + Grace n'est pas une feature sociale, c'est une contrainte de sécurité.**
Deux personnes en couple partageant un outil intime = le pire endroit possible pour une fuite. Partage **opt-in, granulaire, agrégé**. Jamais d'accès aux lignes brutes.

### Principes de décision

Face à une ambiguïté, dans cet ordre :

1. La simplicité l'emporte.
2. L'usage quotidien l'emporte sur la richesse fonctionnelle.
3. La confidentialité l'emporte sur la commodité.
4. **Consistance > perfection** — le produit ne doit jamais punir.
5. Ne pas ajouter de complexité juste parce que c'est techniquement possible.
6. Toujours se demander : *« qu'est-ce que ça donne après 6 mois d'usage quotidien ? »*

Sensation visée : **« C'est ici que je gère la personne que je deviens. »**
Pas : « C'est ici que je coche des cases. »

---

## 2. Vocabulaire du domaine (à respecter dans tout le code)

| Terme | Définition | Ne jamais confondre avec |
|---|---|---|
| **Vision** | Le futur que je veux créer, par domaine de vie. Non mesurable. | Goal |
| **Goal** | Un résultat concret et daté. Mesurable ou binaire. | Habit |
| **Habit** | Un comportement répété qui alimente un goal. | Goal |
| **Schedule** | La règle qui définit *quand* une habitude est attendue. Versionnée dans le temps. | Habit |
| **Occurrence** | Une instance attendue d'une habitude à une date donnée. **Concept calculé, jamais stocké.** | Log |
| **Log** | Ce que l'utilisateur a réellement enregistré (`habit_logs`). | Occurrence |
| **Completion** | Ratio ∈ [0,1] d'une occurrence. | `completed` (booléen) |
| **Daily score** | Moyenne pondérée des completions du jour. | Nombre d'habitudes complétées |
| **Consistency** | Σ numérateurs / Σ dénominateurs sur une période. | Moyenne des daily scores |
| **Metric** | Une série mesurable dont la cible se repose chaque mois. | Goal (cible unique, datée) |
| **Output** | Ce que j'ai produit ce mois-ci. `Metric.kind = 'output'`. | Habit |
| **Result** | Ce que mon travail a généré. `Metric.kind = 'result'`. | Output |
| **MetricEntry** | La valeur d'une métrique pour un mois. Son existence met la métrique au contrat du mois. | Metric |
| **Fondation / Exécution / Impact** | Les trois couches du bilan mensuel. | Un score unique |

Nommer les variables et les fonctions avec ces termes exacts. `isScheduledOn`, `expectedOccurrences`, `computeCompletion`, `dailyScore`, `consistency`, `currentStreak`.

---

## 3. Stack technique

```
Framework    Next.js 16 (App Router) + React 19 + TypeScript strict
Styling      Tailwind CSS v4 + design tokens CSS
Composants   shadcn/ui (copiés dans le repo, pas une dépendance)
Animation    framer-motion (sobre, voir §8)
Backend      Supabase — Postgres + Auth + Storage + RLS
Charts       Recharts
Icônes       Lucide
Dates        date-fns + date-fns-tz  ← jamais de Date natif manipulé à la main
Tests        Vitest (domaine) + tests d'autorisation SQL
Deploy       Vercel
Mobile       PWA installable (manifest + service worker minimal). Pas de React Native.
```

### Choix écartés — ne pas les reproposer sans raison nouvelle

| Écarté | Pourquoi |
|---|---|
| Vite + SPA | Pas de Server Components pour l'AI Coach (clé API côté client), pas de cron Vercel, pas de SSR du dashboard. Next est déjà maîtrisé sur l'autre projet. |
| Prisma / Drizzle | Un ORM avec la service-role key court-circuite RLS et détruit la garantie de confidentialité. Client Supabase direct + RPC Postgres. |
| Local-first / offline sync | Complexité de merge disproportionnée pour 2 utilisateurs. À reconsidérer en V3. |
| React Native | Une PWA suffit pour « ouvrir → taper → fait ». |

---

## 4. Architecture

```
app/
  (auth)/            login · signup · callback
  (onboarding)/      wizard 5 étapes → /today
  (app)/
    today/           ⭐ écran par défaut au lancement
    dashboard/
    habits/
    goals/
    calendar/
    vision/
    analytics/
    reviews/
    together/
    settings/
lib/
  supabase/          clients browser/server + types générés
  domain/            ⭐ logique métier PURE — zéro React, zéro Supabase
    scheduling.ts      isScheduledOn · expectedOccurrences
    scoring.ts         computeCompletion · dailyScore · consistency
    streaks.ts         currentStreak · longestStreak
    goals.ts           goalProgress · deriveFromHabits · pace
    dates.ts           toLocalDate · localToday
  queries/           accès données (server actions + hooks client)
components/
  ui/                shadcn
  habits/ goals/ charts/ vision/ ...
```

### Règles d'architecture non négociables

1. **`lib/domain/` ne connaît ni React ni Supabase.** Fonctions pures, entrées/sorties typées, 100% testées. C'est ce qui permet de recalculer les scores côté serveur (RPC, cron, AI Coach) sans dupliquer la logique.
2. **Aucun calcul de pourcentage dans un composant.** Si un `/` ou un `* 100` apparaît dans un `.tsx`, c'est un bug d'architecture. Tout passe par `lib/domain/scoring.ts`.
3. **Pas de composant > 200 lignes.** Découper par responsabilité, pas par écran.
4. **Les Server Components lisent, les Server Actions écrivent.** Pas de `fetch` de données dans un composant client.
5. Un seul endroit définit un type métier : les types générés Supabase + des types de domaine dérivés dans `lib/domain/types.ts`.

---

## 5. Invariants métier — NON NÉGOCIABLES

C'est la section la plus importante du fichier. Toute violation détruit la crédibilité des chiffres.

### 5.1 Le jour est local, jamais UTC

- `habit_logs.local_date` est un **`DATE`**, jamais un `timestamptz`.
- La conversion timezone → date locale se fait **une seule fois, à l'écriture**, depuis `profiles.timezone`.
- Tout le reste du système raisonne en dates nues.
- Changer sa timezone ne réécrit **jamais** l'historique.

> Sans cette règle : cocher une habitude à 23h à Douala l'enregistre le lendemain en UTC, la série casse, personne ne comprend pourquoi.

### 5.2 Deux natures de planning, pas une

| Nature | Modes | Comportement |
|---|---|---|
| **Daté** | `daily` · `days_of_week` · `days_of_month` | Attendue un jour précis. **Entre au dénominateur du score quotidien.** |
| **Quota** | `times_per_week` · `times_per_month` | Aucun jour n'est attendu. **N'entre JAMAIS au dénominateur quotidien.** Compte dans la consistance hebdo/mensuelle. |

Une habitude « 3 séances/semaine » ne peut pas rater un lundi. Dans Today, elle apparaît en section « Disponibles » avec un compteur `1/3 cette semaine`.

> Sans cette règle : un utilisateur avec 3 habitudes à quota démarre chaque journée à 0% et se sent en échec en permanence.

### 5.3 L'historique est immuable

Modifier le planning d'une habitude ne doit **jamais** recalculer les scores passés. Le calcul d'un jour passé utilise la règle en vigueur **ce jour-là** (`habit_schedules` daté via `effective_from` / `effective_to`).

Corollaire : **jamais de `DELETE` sur `habits`, `goals`, `habit_logs`.** Uniquement `archived_at`.

### 5.4 Formules

**Completion d'une occurrence** — toujours ∈ [0, 1] :

```
boolean                              → completed ? 1 : 0
numeric|duration|quantity|counter
  direction = at_least               → target > 0 ? min(value / target, 1)
                                                  : (value > 0 ? 1 : 0)
  direction = at_most                → value <= target ? 1
                                                       : max(0, 1 - (value - target) / target)
```

Le dépassement est **stocké et affiché** (« 75/60 min ») mais ne dépasse jamais 100% dans le score. Sinon une surperformance masque trois échecs.

**Score quotidien** :

```
daily_score(D) = Σ (weight × completion) / Σ weight
                 sur les habitudes à planning DATÉ attendues le jour D

Aucune habitude attendue → score = null (jour NEUTRE), surtout pas 0.
```

Deux nombres distincts à ne jamais confondre dans les libellés :
- `daily_score` → **84%**
- habitudes complétées → **5/6** (où « complétée » = `completion === 1`)

**Consistance sur une période** :

```
consistency = Σ numérateurs / Σ dénominateurs      (pondéré par occurrence)
```

⚠️ **Ce n'est PAS la moyenne des daily scores.** Lundi 1 habitude ratée (0%) + mardi 8 réussies (100%) → la moyenne des jours donne 50%, la réalité est 8/9 = 89%.

Habitudes à quota sur la période : numérateur `min(nb_faits, N)`, dénominateur `N`.
Même formule filtrée par `category` → **scores par domaine de vie**. Aucune logique séparée à écrire.

**Streaks** :

- **Par habitude** : occurrences *attendues* consécutives avec `completion === 1`. Les jours non planifiés sont **sautés**, pas comptés comme échec. Lun/Mer/Ven tenue 3 semaines = streak de **9**, pas de 1.
- **Globale** : jours locaux consécutifs avec `daily_score >= 0.8`. Les jours neutres sont sautés sans casser la série.
- **Le jour courant ne casse jamais la série tant qu'il n'est pas terminé.** (Sinon le streak affiche 0 tous les matins à 6h.)
- **Freeze** : 1 jour de grâce par semaine glissante, consommé automatiquement, affiché honnêtement (« série maintenue avec 1 joker »).

**Progression d'un goal** :

```
source = 'manual'      → current_value saisi à la main
source = 'habit_count' → COUNT(logs avec completion === 1) sur [start_date, due_date]
source = 'habit_sum'   → SUM(value) sur la même fenêtre

progress = min(current_value / target_value, 1)
```

`status` : `not_started → in_progress → completed` automatique selon la progression. `abandoned` reste manuel.
**Pace indicator** : « 3/5, 12 jours restants → sur la trajectoire / en retard ». Plus actionnable qu'une barre seule.

**Goal partagé** : `Σ contributions (tous participants) / target`, avec répartition par personne visible. Chacun n'écrit que ses propres contributions, chacun voit le total.

### 5.5 Où les calculs s'exécutent

TypeScript pur dans `lib/domain/`, exécuté côté serveur (RSC). **Une seule duplication tolérée** : `get_couple_overview` en SQL (obligatoirement `security definer`). Elle est couverte par des tests comparant les deux implémentations sur les mêmes jeux de données.

---

## 6. Base de données

### Conventions

- `snake_case` partout, tables au pluriel.
- Toute table utilisateur porte `user_id uuid not null` → RLS.
- `created_at` / `updated_at` en `timestamptz default now()` + trigger sur update.
- Enums Postgres pour : `habit_type`, `habit_category`, `habit_direction`, `schedule_kind`, `goal_scope`, `goal_source`, `goal_status`, `review_kind`.
- Suppression = `archived_at timestamptz`, jamais de `DELETE`.
- Dates métier en `date`. Horodatages techniques en `timestamptz`.

### Entités

```
auth.users
  └─1:1─ profiles
           ├─1:N─ vision_areas ──1:N── vision_items
           ├─1:N─ goals ──1:N── goal_contributions
           │        └─N:M── habits (via goal_habits)
           ├─1:N─ habits ──1:N── habit_schedules   (effective-dated)
           │                └─1:N── habit_logs      (unique: habit_id + local_date)
           ├─1:N─ reviews (weekly | monthly)
           └─1:N─ couple_members ──N:1── couples
                                          └─1:N── shared_goals ──1:N── shared_goal_contributions
           └─1:1─ sharing_settings (par couple)
```

### Index obligatoires

```
habit_logs (user_id, local_date)
habit_logs (habit_id, local_date)
habits     (user_id) where archived_at is null
habit_schedules (habit_id, effective_from)
goals      (user_id, scope, due_date)
```

---

## 7. Sécurité & confidentialité

Trois niveaux, dans cet ordre de rigueur :

**1. Tables privées** (`habits`, `habit_logs`, `goals`, `vision_*`, `reviews`) — policy unique, sans exception :

```sql
using (user_id = auth.uid()) with check (user_id = auth.uid())
```

**2. Tables couple** (`couples`, `couple_members`, `shared_goals`) — accès si membre actif, via une fonction `is_couple_member(couple_id)` en `security definer` + `stable` (évite la récursion de policy sur `couple_members`).

**3. Données partagées** — ⚠️ **JAMAIS de RLS conditionnelle de partage sur les tables privées.**

> C'est l'erreur classique : on ouvre `habit_logs` « si le partenaire a activé le partage », et n'importe quelle jointure un peu créative expose les notes intimes de l'autre.

À la place : **`get_couple_overview(couple_id)` en `security definer`**, qui lit les données brutes en interne, applique les `sharing_settings` du partenaire, et ne retourne **que des scalaires agrégés** :

```
{ display_name, daily_score, current_streak, monthly_consistency, shared_goal_progress }
```

Aucune ligne brute ne traverse jamais la frontière entre les deux comptes.

**`sharing_settings`** : une ligne par (user, couple), booléens `share_daily_score`, `share_streak`, `share_monthly_consistency`, `share_vision_board`, `share_goal_ids uuid[]`.
**Défaut : tout à `false`.** L'utilisateur ouvre ce qu'il veut, quand il veut.

### Règles absolues

- Jamais de filtrage de confidentialité côté front uniquement.
- Jamais de `service_role` key dans du code applicatif — et **jamais dans une variable
  `NEXT_PUBLIC_*`**, qui est inlinée dans le JavaScript envoyé au navigateur. Une `service_role`
  key à cet endroit ouvre la base entière en lecture et en écriture à n'importe quel visiteur et
  annule toutes les policies de `supabase/migrations/`. Vérifier le rôle en décodant le JWT
  avant de coller une clé : le payload doit contenir `"role":"anon"`.
- Images (vision board, evidence) : buckets **privés** + URLs signées à durée courte.
- Le test « Grace tente de lire les données de Ryan » doit retourner 0 ligne **par tous les chemins possibles**, et fait partie de la suite CI.

---

## 8. Design system

### Direction

**Dark uniquement en V1.** Un thème fait parfaitement vaut mieux que deux tièdes. Références : Linear, Notion, sobriété Apple.

Ton : **outil sérieux, calme, précis.** Ce n'est pas une app de fitness gamifiée. On ouvre ce produit le matin et le soir, tous les jours, pendant des années.

### Tokens (à valider avant M0)

```css
--bg:          #0B0C0E   /* fond app */
--surface:     #121316   /* cartes */
--surface-2:   #17191D   /* élévation */
--border:      #23262B   /* bordures subtiles — 1px, jamais plus */
--text:        #EDEEF0
--text-muted:  #8B9096
--text-faint:  #5A5F66

--accent:      #E8C15C   /* or sobre — progression, streak, CTA */
--success:     #4E9C6B   /* complété */
--warn:        #C98A3E   /* en retard */
--danger:      #B4544A   /* raté, destructif */

--radius:      10px      /* uniforme, jamais > 14px */
```

Palette de complétion (calendrier / heatmap) — 5 paliers de `--surface` vers `--accent`, jamais de rouge pour les jours ratés (le produit ne punit pas).

### Typographie

```
--font-ui       'Instrument Sans' ou 'General Sans'   — interface
--font-display  'Instrument Serif'                    — Vision & Reviews UNIQUEMENT
--font-mono     'Geist Mono'                          — chiffres, scores, tabular-nums
```

**Interdites** : Inter, Roboto, system-ui, Space Grotesk, Helvetica Neue.
**Règle** : tout chiffre affiché dans un tableau, un score ou un compteur utilise `font-variant-numeric: tabular-nums`. Sinon les colonnes dansent au changement de valeur.

Le serif est **réservé** aux écrans Vision et Reviews — c'est le contraste émotionnel du produit. Il n'apparaît jamais dans Today, Habits ou Analytics.

### Espacement & composition

- Échelle 4px. Sections aérées, densité contrôlée sur Today (l'écran le plus utilisé doit être compact).
- Bordures 1px, ombres quasi inexistantes. Séparer par la couleur de surface, pas par l'ombre.
- Maximum 2 niveaux d'élévation visibles simultanément.

### Animation

- `--ease: cubic-bezier(0.16, 1, 0.3, 1)`, durées 120ms (feedback) / 240ms (transition).
- **Le tap sur une habitude est optimiste et instantané.** Aucune animation ne doit retarder le feedback.
- Respecter `prefers-reduced-motion`.
- Un seul moment animé par écran, maximum.

### Gamification

| Autorisé | Interdit |
|---|---|
| Streaks · consistance · progression · jalons discrets | Points partout · badges enfantins · confettis · classements · notifications agressives |

Objectif psychologique : **« aide-moi à être constant »**, jamais **« rends-moi accro »**.

---

## 9. Mobile & interactions

Le mobile est **prioritaire**, pas une adaptation du desktop.

- **Navigation** : desktop = sidebar 10 items. Mobile = bottom bar **4 items — Today · Calendar · Goals · More**. Une bottom bar à 10 items est inutilisable.
- **Le flow critique** : `ouvrir → Today → tap → fait`. Aucun écran intermédiaire, aucune modale.
- Habitude numérique : tap → stepper **inline** avec incréments intelligents (+1/+10 pompes, +15min étude). Jamais de clavier ouvert par défaut.
- Touch targets ≥ 44×44px.
- Les 5 premières habitudes du jour visibles **sans scroll** sur un écran mobile standard.
- Updates optimistes obligatoires sur le logging. Une coche qui attend le réseau tue l'usage quotidien.

---

## 10. Conventions de code

- TypeScript **strict**. Pas de `any`. Pas de `as` sans commentaire justificatif.
- Validation des entrées avec Zod, côté serveur, sur toutes les Server Actions.
- Tout écran gère explicitement : **loading · error · empty**. Les états vides sont soignés — c'est le premier écran que voit un nouvel utilisateur.
- Jamais de fonctionnalité simulée. Si un morceau de backend n'existe pas, le dire clairement plutôt que de faire semblant que ça marche.
- Nommage en anglais dans le code, UI en anglais (conforme aux maquettes du spec).
- Un composant = un fichier. Pas de barrel files géants.

---

## 11. Tests

Périmètre volontairement étroit mais non négociable :

| Quoi | Comment |
|---|---|
| `lib/domain/` | Vitest, couverture proche de 100%. Cas obligatoires : jours neutres, quotas, `at_most`, changement de planning rétroactif, streak avec freeze, bascule de timezone. |
| Autorisation | Suite SQL : pour chaque table privée, « l'autre utilisateur lit → 0 ligne ». Tourne en CI. |
| `get_couple_overview` | Comparaison des résultats SQL vs implémentation TS sur des jeux de données identiques. |

Pas de tests E2E en V1. Pas de tests de composants sauf logique non triviale.

---

## 12. Ce qu'il ne faut PAS construire maintenant

| Reporté | Raison |
|---|---|
| **AI Coach** | Sans 60+ jours de données, il ne produit que des banalités. Le schéma le permet déjà, c'est suffisant. |
| **Notifications push** | Service workers + permissions + cron + préférences = un milestone entier. V2. |
| **Vision board canvas libre** (drag/resize/z-index) | Coût énorme, surtout mobile. Grille de tuiles réordonnables = 90% de la valeur pour 10% du travail. |
| **Photo evidence sur les habitudes** | Ajoute de la friction au moment le plus sensible du produit (le tap). Note + valeur suffisent. V1.1. |
| ~~**Monthly review**~~ | **Construite le 19/08/2026**, contre l'avis initial de cette section : elle est devenue le point d'arrivée du bilan à trois couches, qui n'a de sens que s'il se referme sur « qu'est-ce que je change ». La weekly, elle, reste à faire (M9). |
| **Badges / achievements** | Streak + consistance suffisent. Le reste vire au gadget. |
| **Analytics avancées** (corrélations, meilleures heures, prédictions) | 4 graphiques en V1. Le reste attend une vraie question, sur de vraies données. |
| **Multi-couple / groupes / amis** | Le schéma le permet, n'implémenter que le cas à 2. |
| **Offline / sync** | Voir §3. |
| **Récurrences complexes** (« tous les 3 jours », « 2e mardi du mois ») | Cas rares, complexité de calcul disproportionnée. |
| **Light mode** | Voir §8. |

Si une de ces lignes est réclamée en cours de route : rappeler cette section avant de l'implémenter.

---

## 13. Roadmap

Chaque milestone est livrable et testable seul.

| # | Milestone | Definition of Done |
|---|---|---|
| **M0** | Fondations | App déployée sur Vercel, layout + tokens, CI qui fait tourner Vitest. |
| **M1** | Auth & profils | Deux comptes actifs ✅ ; isolation vérifiée à la main le 19/08/2026 ✅ ; **reste le test automatisé en CI**. |
| **M2** ⭐ | Habitudes & planning | « Quelles habitudes sont attendues le 17 août ? » correct pour les 5 modes, **y compris après modification rétroactive**. |
| **M3** ⭐ | Today & tracking | Cocher une habitude sur mobile = 1 tap, feedback instantané. |
| **M4** | Scoring & streaks | Tous les invariants de §5 couverts par des tests. |
| **M5** | Goals | Un goal `habit_count` avance tout seul quand on coche l'habitude liée. |
| **M6** | Vision & onboarding | Un nouveau compte va de signup à Today sans jamais voir un écran vide. |
| **M7** | Calendrier & Dashboard | Cliquer le 12 août montre **et permet de corriger** cette journée. |
| **M8** | Couple | La suite de tests d'autorisation passe — aucune donnée non partagée atteignable, par aucun chemin. |
| **M9** | Reviews & Analytics | Le dimanche, la weekly review s'ouvre pré-remplie des stats de la semaine. |
| **M10** | Polish | Utilisable un mois entier sans rencontrer un état non géré. PWA installable. |

M2 et M3 sont les deux vrais gros morceaux. Le dashboard est facile ; l'éditeur d'habitude (5 types × 5 plannings × 2 directions) et l'écran Today ne le sont pas.

---

## 14. Décisions ouvertes — bloquent la Phase 2

1. **Versionnement du planning** — `habit_schedules` daté (historique immuable, recommandé, ~1 jour de travail en plus) **ou** fréquence sur `habits` avec « éditer = archiver + recréer » ?
   *Défaut de travail : versionné.*
2. **Seuil du streak global** — `daily_score >= 0.8` + 1 joker/semaine (recommandé) **ou** 100% strict **ou** « au moins une habitude » ?
   *Défaut de travail : 0.8 + joker.*
3. **Goals auto-alimentés par les habitudes** — confirmé comme pari central, **ou** saisie manuelle uniquement en V1 ?
   *Défaut de travail : auto-alimentés.*

Résoudre ces trois points avant d'écrire la première migration. Les inscrire ici comme décidées, avec la date, une fois tranchées.

---

## 15. Anti-patterns — signaux d'alarme

Si tu vois ça dans le code, c'est un bug d'architecture, pas un détail :

- Un `* 100` ou un calcul de ratio dans un `.tsx`
- Un `timestamptz` utilisé pour représenter « le jour de l'utilisateur »
- Une policy RLS qui contient le mot `share`
- Un `DELETE from habits`
- La moyenne de tableaux de daily scores pour obtenir une consistance
- Une habitude à quota qui apparaît au dénominateur du score quotidien
- Un `completion` qui peut dépasser 1
- Un streak qui affiche 0 le matin avant que la journée soit jouée
- « Ryan » ou « Grace » en dur ailleurs que dans un seed de développement
- Une modale ou un second écran entre l'utilisateur et le fait de cocher une habitude
- Un champ de saisie qui permettrait de ressaisir à la main un chiffre déjà dans `habit_logs`
- `Σ min(réalisé, cible) / Σ cible` sur des métriques d'unités différentes
- Une métrique non saisie affichée comme un zéro
- Une observation du bilan qui affirme une cause au lieu de proposer une piste
- Du rouge sur un jour raté dans le calendrier
- Un état vide non conçu

---

*Ce fichier fait autorité sur toutes les décisions produit, techniques et de design du projet.*
*Toute déviation doit être justifiée explicitement, et ce fichier mis à jour en conséquence.*
