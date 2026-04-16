"use client"

import { Component, ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  /** When any value in this array changes, the boundary auto-resets. */
  resetKeys?: unknown[]
}

interface State {
  hasError: boolean
  error?: Error
}

function keysDiffer(a: unknown[] | undefined, b: unknown[] | undefined): boolean {
  if (a === b) return false
  if (!a || !b || a.length !== b.length) return true
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true
  return false
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo)
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && keysDiffer(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ hasError: false, error: undefined })
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-destructive/10 border border-destructive/30 rounded-lg">
          <h2 className="text-lg font-semibold text-destructive mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
