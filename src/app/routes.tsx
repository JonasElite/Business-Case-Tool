import { createBrowserRouter } from 'react-router';
import { LandingPage } from './pages/LandingPage';
import { ToolWrapper } from './components/ToolWrapper';
import { AipipLayout, AipipHomeWrapper } from './components/AipipLayout';
import { Home } from './pages/Home';
import { Benchmarking } from './pages/Benchmarking';
import { BusinessCasePage } from './pages/BusinessCasePage';
import { AipipPage } from './pages/AipipPage';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      Component: LandingPage,
    },
    {
      path: '/demo',
      Component: ToolWrapper,
      children: [
        { index: true, Component: Home },
        { path: 'benchmarking', Component: Benchmarking },
        { path: 'business-case', Component: BusinessCasePage },
      ],
    },
    {
      path: '/project',
      Component: ToolWrapper,
      children: [
        { index: true, Component: Home },
        { path: 'benchmarking', Component: Benchmarking },
        { path: 'business-case', Component: BusinessCasePage },
      ],
    },
    {
      path: '/aipip',
      Component: AipipLayout,
      children: [
        { index: true, Component: AipipHomeWrapper },
        { path: 'simulator', Component: AipipPage },
      ],
    },
  ],
  {
    // Serves the app correctly when it is not hosted at the domain root,
    // e.g. a GitHub Pages project site under /<repo>/.
    basename: import.meta.env.BASE_URL,
  },
);
