import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { registerSW } from "virtual:pwa-register";

import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import { appRouter } from "./router";

registerSW({ immediate: true });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={appRouter} />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
