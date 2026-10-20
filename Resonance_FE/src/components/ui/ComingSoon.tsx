/** Segnaposto di una sezione che nasce in una card successiva: titolo e un avviso, niente di finto sotto. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="text-body-secondary">Questa sezione arriva presto.</p>
    </>
  )
}
