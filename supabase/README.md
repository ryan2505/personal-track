# Supabase — schéma Personal OS

Schéma complet de la Phase 2. **Aucune migration n'a encore été exécutée** : elles
sont écrites et relues, pas éprouvées contre un vrai serveur.

## Les migrations

| Fichier | Contenu |
|---|---|
| `0001_foundations.sql` | Extensions, enums, trigger `updated_at` |
| `0002_profiles.sql` | Profils, création automatique à l'inscription |
| `0003_vision.sql` | Domaines de vie et vision board |
| `0004_habits.sql` | Habitudes, **plannings datés**, journal |
| `0005_goals.sql` | Objectifs et liaison aux habitudes |
| `0006_reviews.sql` | Revues hebdo et mensuelles |
| `0007_couples.sql` | Espace couple, réglages de partage, objectifs partagés |
| `0008_scoring.sql` | Scoring en SQL (duplication assumée du domaine TS) |
| `0009_couple_overview.sql` | **La frontière de confidentialité** |
| `0010_shared_boards.sql` | Liens de partage vivants |
| `0011_storage.sql` | Buckets privés `vision` et `evidence` |

## Appliquer

En local :

```bash
supabase start
supabase db reset      # rejoue toutes les migrations à partir de zéro
```

Sur un projet distant :

```bash
supabase link --project-ref <ref>
supabase db push
```

Sans la CLI, coller les fichiers dans l'ordre dans le SQL Editor du dashboard.

Puis renseigner `.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon>
```

## Ce que la base garantit elle-même

Ces règles ne sont pas laissées au client — une donnée incohérente est refusée
à l'écriture :

- **Un planning ne se chevauche jamais.** Contrainte d'exclusion GiST sur
  `habit_schedules` : à une date donnée, une habitude a au plus une règle.
  C'est l'invariant qui rend l'historique immuable (CLAUDE.md §5.3).
- **Un log ne peut pas changer de propriétaire.** Clés étrangères composites
  `(habit_id, user_id)` : impossible de rattacher son log à l'habitude d'un
  autre, même en contournant l'application.
- **Un jour, un log.** `unique (habit_id, local_date)` rend `completion`
  déterministe.
- **Une habitude binaire n'a ni cible ni unité**, et « ne pas dépasser » exige
  une cible : sinon `completion` aurait deux définitions pour la même ligne.
- **Un fuseau invalide est rejeté** à l'écriture du profil, plutôt que de
  fausser silencieusement toutes les dates locales.
- **Un planning incohérent est rejeté** : `days_of_week` sur un quota, tableau
  vide, jour hors 1–7 ou 1–31.

## Le modèle de confidentialité

Trois niveaux, par ordre de rigueur (CLAUDE.md §7) :

1. **Tables privées** — `using (user_id = auth.uid())`, sans exception.
2. **Tables couple** — appartenance vérifiée via `is_couple_member()`, en
   `security definer` + `stable` pour éviter la récursion de policy.
3. **Données partagées** — **jamais** par RLS conditionnelle. Uniquement via
   `get_couple_overview()`, qui lit en interne, applique les
   `sharing_settings` du partenaire, et ne renvoie que des scalaires. Aucune
   ligne brute ne traverse la frontière entre deux comptes.

Une conséquence volontaire : `sharing_settings` n'est lisible que par son
propriétaire. Le partenaire n'a pas à savoir ce qui lui est caché.

## La duplication assumée

`0008_scoring.sql` réimplémente `src/lib/domain/{scheduling,scoring,streaks}.ts`.
C'est la seule duplication tolérée du projet, et elle existe parce que
`get_couple_overview` doit calculer les chiffres du partenaire **côté serveur**,
sans jamais exposer ses lignes.

Elle doit être tenue par des tests comparant les deux implémentations sur des
jeux de données identiques — **ces tests n'existent pas encore.** Toute
évolution d'une formule doit être portée des deux côtés le même jour.

Les fonctions de scoring sont volontairement en `security invoker` : appelées
par un client sur l'identifiant de quelqu'un d'autre, la RLS les rend aveugles
et elles renvoient `null`.

## Points de vigilance

- **Performance** : le scoring SQL est en O(jours × habitudes). Assumé à cette
  échelle. Si ça coince, la réponse est une table `daily_scores` matérialisée,
  pas une réécriture des formules.
- **Storage** : toute la sécurité des buckets repose sur la convention de chemin
  `<user_id>/<fichier>`. Un client qui ne la respecte pas se verra refuser
  l'écriture, mais c'est au code applicatif de la tenir.
- **`enable_confirmations = false`** dans `config.toml` ne vaut que pour le
  développement local. À laisser à `true` en production.
