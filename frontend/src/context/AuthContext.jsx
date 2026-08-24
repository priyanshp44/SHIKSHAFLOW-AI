import { createContext, useReducer, useEffect } from 'react'

export const AuthContext = createContext(null)

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
}

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return {
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
      }
    case 'LOGOUT':
      return initialState
    default:
      return state
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState, () => {
    const token = localStorage.getItem('sf_token')
    const user = localStorage.getItem('sf_user')
    if (token && user) {
      return { token, user: JSON.parse(user), isAuthenticated: true }
    }
    return initialState
  })

  function login(user, token) {
    localStorage.setItem('sf_token', token)
    localStorage.setItem('sf_user', JSON.stringify(user))
    dispatch({ type: 'LOGIN', payload: { user, token } })
  }

  function logout() {
    localStorage.removeItem('sf_token')
    localStorage.removeItem('sf_user')
    dispatch({ type: 'LOGOUT' })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
