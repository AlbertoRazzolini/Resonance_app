import { useEffect, useState } from 'react'
import { Form } from 'react-bootstrap'
import { Link, useSearchParams } from 'react-router'
import { ROUTES } from '@/app/routes'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { SearchResultsPage } from '../components/SearchResultsPage'

/** Attesa dopo l'ultimo tasto: il limite `USER_SEARCH` del backend conta anche le richieste sbagliate (decisione 64). */
const SEARCH_DELAY_MS = 400
/** Lunghezze ammesse dal backend per `q`, dopo il trim (progettazione, sezione 6.5). */
const MIN_CHARS = 2
const MAX_CHARS = 50

/** Risultati accumulati con «Carica altri»; si rimonta (key) a ogni testo nuovo, così riparte dalla prima pagina. */
function SearchResults({ term }: { term: string }) {
  const [pages, setPages] = useState(1)
  return (
    <>
      {Array.from({ length: pages }, (_, page) => (
        <SearchResultsPage
          key={page}
          term={term}
          page={page}
          isLast={page === pages - 1}
          onLoadMore={() => setPages(page + 2)}
        />
      ))}
    </>
  )
}

/**
 * Cerca persone per nome (progettazione, sezioni 6.5 e 6.14): la richiesta parte 400 ms dopo l'ultimo tasto e solo con
 * almeno 2 caratteri, spazi ai bordi esclusi. Il testo cercato sta nell'indirizzo (`?q=`), così «Indietro» dal profilo di
 * una persona ritrova la ricerca.
 */
export function Component() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlTerm = searchParams.get('q') ?? ''
  const [text, setText] = useState(urlTerm)
  const trimmed = useDebouncedValue(text.trim(), SEARCH_DELAY_MS)
  const term = trimmed.length >= MIN_CHARS ? trimmed : ''

  useEffect(() => {
    if (term !== urlTerm) setSearchParams(term ? { q: term } : {}, { replace: true })
  }, [term, urlTerm, setSearchParams])

  return (
    <>
      <div className="rs-collab-head">
        <div>
          <h1>Cerca persone</h1>
          <p className="text-body-secondary">Trova una persona per nome e chiedile l&apos;amicizia.</p>
        </div>
        <Link className="btn btn-outline-light" to={ROUTES.friends}>
          I tuoi amici
        </Link>
      </div>

      <Form role="search" onSubmit={(event) => event.preventDefault()}>
        <Form.Control
          type="search"
          aria-label="Cerca per nome"
          placeholder="Cerca per nome"
          maxLength={MAX_CHARS}
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </Form>

      <section aria-label="Risultati" className="mt-3">
        {term ? (
          <SearchResults key={term} term={term} />
        ) : (
          <p className="rs-field-hint">Scrivi almeno 2 caratteri per cercare.</p>
        )}
      </section>
    </>
  )
}
