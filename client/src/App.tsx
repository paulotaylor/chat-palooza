import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, createBrowserRouter, Outlet } from 'react-router-dom';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/common/Navbar';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Conversation from './pages/Conversation';
import History from './pages/History';
import Profile from './pages/Profile';
import { GoogleOAuthProvider } from '@react-oauth/google';

const theme = createTheme({
  palette: {
    primary: {
      main: '#086f95',
    },
    secondary: {
      main: '#03dac6',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Comic Neue", Arial, sans-serif',
    button: {
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          padding: '8px 24px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          transition: 'transform 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
          },
        },
      },
    },
  },
});

function App() {

  const AppLayout = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {/* Outlet will render the matched child route */}
        <Outlet />
      </Box>
    </Box>
  );

  const router = createBrowserRouter([
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: <Home /> },
        { path: 'auth', element: <Auth /> },
        { path: 'conversation/:id', element: <Conversation /> },
        { path: 'history', element: <History /> },
        { path: 'profile', element: <Profile /> },
        { path: 'assets', element: <div /> }, // Placeholder for /assets/
        { path: '*', element: <Navigate to="/" replace /> }
      ]
    }
  ]);
  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || ''}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
