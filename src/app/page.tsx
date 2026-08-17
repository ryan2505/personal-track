import { redirect } from "next/navigation";

/** L'écran par défaut au lancement est Today. Tout le reste est secondaire. */
export default function Home() {
  redirect("/today");
}
