/** Mostrata mentre il router carica la prima pagina (moduli differiti), per non lasciare lo schermo vuoto. */
export function HydrateFallback() {
  return (
    <p className="p-4 text-body-secondary" role="status">
      Caricamento…
    </p>
  )
}
