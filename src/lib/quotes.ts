import { diffDays, type LocalDate } from "@/lib/domain";

/**
 * Citations proposées par défaut.
 *
 * Deux règles tenues ici :
 *
 * 1. **Pas de fausse attribution.** Une citation dont l'auteur est incertain
 *    est laissée sans auteur plutôt que rattachée au nom qui circule le plus.
 *    Exemple : « L'excellence est une habitude » est presque toujours prêtée à
 *    Aristote alors qu'elle est de Will Durant, qui le paraphrasait — c'est
 *    Durant qui est crédité ici.
 *
 * 2. **Ton sobre.** Rien d'euphorisant ni d'injonctif : le produit ne cherche
 *    pas à exciter, il cherche à soutenir la constance (CLAUDE.md §8, §25).
 */
export interface Quote {
  text: string;
  /** `null` quand l'attribution n'est pas sûre. */
  author: string | null;
}

export const DEFAULT_QUOTES: Quote[] = [
  {
    text: "Nous sommes ce que nous faisons de manière répétée. L'excellence n'est donc pas un acte, mais une habitude.",
    author: "Will Durant",
  },
  {
    text: "La discipline est le pont entre les objectifs et les accomplissements.",
    author: "Jim Rohn",
  },
  {
    text: "Un voyage de mille lieues commence toujours par un premier pas.",
    author: "Lao Tseu",
  },
  {
    text: "Ce n'est pas la montagne que nous conquérons, mais nous-mêmes.",
    author: "Edmund Hillary",
  },
  {
    text: "Il n'y a pas de vent favorable pour celui qui ne sait où il va.",
    author: "Sénèque",
  },
  {
    text: "La qualité n'est jamais un accident : elle est toujours le résultat d'un effort intelligent.",
    author: "John Ruskin",
  },
  {
    text: "Fais ce que tu peux, avec ce que tu as, là où tu es.",
    author: "Theodore Roosevelt",
  },
  {
    text: "Ce n'est pas le manque de temps qui nous arrête, c'est le manque de direction.",
    author: null,
  },
  {
    text: "Une journée ratée ne défait pas trois semaines de travail. L'abandon, si.",
    author: null,
  },
  {
    text: "La régularité bat l'intensité sur toutes les distances qui comptent.",
    author: null,
  },
  {
    text: "Tu ne t'élèves pas au niveau de tes ambitions, tu retombes au niveau de tes systèmes.",
    author: null,
  },
  {
    text: "Commencer petit et tenir vaut mieux que commencer grand et s'arrêter.",
    author: null,
  },
];

const EPOCH: LocalDate = "1970-01-01";

/**
 * Citation du jour : rotation stricte, un cran par jour.
 *
 * Surtout pas de tirage aléatoire — la citation changerait à chaque rendu et
 * différerait entre le serveur et le client.
 *
 * Un hachage du texte de la date avait été essayé d'abord : il se repliait sur
 * lui-même au passage des dizaines et ne produisait que quatre citations
 * distinctes sur une semaine. Indexer sur le nombre de jours écoulés garantit
 * que le recueil est parcouru en entier avant de se répéter.
 */
export function quoteForDate(date: LocalDate): Quote {
  const elapsed = diffDays(date, EPOCH);
  const size = DEFAULT_QUOTES.length;
  // Double modulo : les dates antérieures à l'époque donneraient un index négatif.
  const quote = DEFAULT_QUOTES[((elapsed % size) + size) % size];
  // `DEFAULT_QUOTES` n'est jamais vide, mais le typage strict impose ce garde-fou.
  return quote ?? { text: "Un jour après l'autre.", author: null };
}
