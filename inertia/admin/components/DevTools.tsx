import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faDatabase,
  faClock,
  faMicrochip,
  faChevronDown,
  faChevronUp,
  faTerminal,
} from '@fortawesome/free-solid-svg-icons'

interface Query {
  sql: string
  bindings: any[]
  duration: number
  timestamp: string
}

interface DevToolsData {
  url: string
  method: string
  executionTime: string
  memoryUsage: string
  queries: Query[]
  queryCount: number
  totalQueryDuration: string
  timestamp: string
}

export function DevTools({ data }: { data: DevToolsData }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'queries'>('overview')

  if (!data) return null

  return (
    <div className="border-t border-line-low bg-backdrop-high text-neutral-high">
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-backdrop-medium select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-6 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-neutral-medium">
            <FontAwesomeIcon icon={faTerminal} className="text-[10px]" />
            DevTools (Last: {data.method} {data.url})
          </span>
          <span className="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faClock} className="text-standout-medium" />
            {data.executionTime}ms
          </span>
          <span className="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faDatabase} className="text-standout-medium" />
            {data.queryCount} queries ({data.totalQueryDuration}ms)
          </span>
          <span className="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faMicrochip} className="text-standout-medium" />
            {data.memoryUsage}
          </span>
        </div>
        <FontAwesomeIcon
          icon={isOpen ? faChevronDown : faChevronUp}
          className="text-neutral-medium"
        />
      </div>

      {isOpen && (
        <div className="h-[400px] flex flex-col border-t border-line-low">
          <div className="flex border-b border-line-low bg-backdrop-medium">
            <button
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-backdrop-high border-b-2 border-standout-medium'
                  : 'hover:bg-backdrop-high'
              }`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                activeTab === 'queries'
                  ? 'bg-backdrop-high border-b-2 border-standout-medium'
                  : 'hover:bg-backdrop-high'
              }`}
              onClick={() => setActiveTab('queries')}
            >
              Queries ({data.queryCount})
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 font-sans leading-relaxed">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-medium mb-3">
                    Request Info
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-[10px] text-neutral-medium">Method</div>
                      <div className="text-xs font-mono">{data.method}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-neutral-medium">URL</div>
                      <div className="text-xs font-mono">{data.url}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-neutral-medium">Timestamp</div>
                      <div className="text-xs font-mono">
                        {new Date(data.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-medium mb-3">
                    Performance
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded border border-line-low bg-backdrop-medium">
                      <div className="text-[10px] text-neutral-medium mb-1">Execution Time</div>
                      <div className="text-lg font-bold text-standout-medium">
                        {data.executionTime}ms
                      </div>
                    </div>
                    <div className="p-3 rounded border border-line-low bg-backdrop-medium">
                      <div className="text-[10px] text-neutral-medium mb-1">Total DB Time</div>
                      <div className="text-lg font-bold text-standout-medium">
                        {data.totalQueryDuration}ms
                      </div>
                    </div>
                    <div className="p-3 rounded border border-line-low bg-backdrop-medium">
                      <div className="text-[10px] text-neutral-medium mb-1">Memory Usage</div>
                      <div className="text-lg font-bold text-standout-medium">
                        {data.memoryUsage}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'queries' && (
              <div className="space-y-3">
                {data.queries.length === 0 ? (
                  <div className="text-xs text-neutral-medium italic py-8 text-center">
                    No queries recorded for this request.
                  </div>
                ) : (
                  data.queries.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded border border-line-low bg-backdrop-medium font-mono text-[11px] leading-normal group hover:border-line-medium transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-1.5 py-0.5 rounded bg-standout-low text-standout-high font-bold uppercase text-[9px]">
                          QUERY {idx + 1}
                        </span>
                        <span
                          className={`font-bold ${q.duration > 10 ? 'text-red-500' : 'text-standout-medium'}`}
                        >
                          {q.duration.toFixed(2)}ms
                        </span>
                      </div>
                      <div className="text-neutral-high whitespace-pre-wrap break-all">{q.sql}</div>
                      {q.bindings && q.bindings.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-line-low/50">
                          <span className="text-neutral-medium text-[10px] uppercase font-bold tracking-tight">
                            Bindings:{' '}
                          </span>
                          <span className="text-neutral-medium">{JSON.stringify(q.bindings)}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
