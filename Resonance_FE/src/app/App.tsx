import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { SessionBootstrap } from './SessionBootstrap'
import { store } from './store'

/** Radice dell'interfaccia: store Redux, avvio della sessione e router. */
export function App() {
  return (
    <Provider store={store}>
      <SessionBootstrap>
        <RouterProvider router={router} />
      </SessionBootstrap>
    </Provider>
  )
}
