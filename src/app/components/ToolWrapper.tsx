import { Outlet } from 'react-router';
import { AppProvider } from '../context/AppContext';
import { Layout } from './Layout';

export function ToolWrapper() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  );
}
