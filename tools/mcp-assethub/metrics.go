package main

import (
	"sync"
	"time"
)

// Metrics holds Prometheus-style metrics for the MCP server
type Metrics struct {
	requestsTotal   map[string]int64
	requestsLatency map[string]*Histogram
	errorsTotal     map[string]int64
	mu              sync.Mutex
}

// Histogram holds latency histogram buckets
type Histogram struct {
	Count    int64
	Sum      float64
	Buckets  map[float64]int64 // bucket -> count
	Inf      int64             // count of values > max bucket
	Mu       sync.Mutex
}

// NewMetrics creates a new Metrics instance
func NewMetrics() *Metrics {
	return &Metrics{
		requestsTotal:   make(map[string]int64),
		requestsLatency: make(map[string]*Histogram),
		errorsTotal:     make(map[string]int64),
	}
}

// Histogram bucket boundaries (in seconds)
var latencyBuckets = []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0}

func newHistogram() *Histogram {
	buckets := make(map[float64]int64)
	for _, b := range latencyBuckets {
		buckets[b] = 0
	}
	return &Histogram{Buckets: buckets}
}

// RecordRequest records a request with its method, duration, and error status
func (m *Metrics) RecordRequest(method string, duration time.Duration, isError bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Count total requests
	m.requestsTotal[method]++

	// Record latency
	hist, ok := m.requestsLatency[method]
	if !ok {
		hist = newHistogram()
		m.requestsLatency[method] = hist
	}

	hist.Mu.Lock()
	hist.Count++
	hist.Sum += duration.Seconds()
	for _, bucket := range latencyBuckets {
		if duration.Seconds() <= bucket {
			hist.Buckets[bucket]++
		}
	}
	if duration.Seconds() > latencyBuckets[len(latencyBuckets)-1] {
		hist.Inf++
	}
	hist.Mu.Unlock()

	// Count errors
	if isError {
		m.errorsTotal[method]++
	}
}

// GetStats returns current metrics statistics
func (m *Metrics) GetStats() MetricsStats {
	m.mu.Lock()
	defer m.mu.Unlock()

	stats := MetricsStats{
		RequestsTotal:   make(map[string]int64),
		ErrorsTotal:     make(map[string]int64),
		Latencies:       make(map[string]LatencyStats),
	}

	for k, v := range m.requestsTotal {
		stats.RequestsTotal[k] = v
	}
	for k, v := range m.errorsTotal {
		stats.ErrorsTotal[k] = v
	}
	for k, hist := range m.requestsLatency {
		hist.Mu.Lock()
		avg := 0.0
		if hist.Count > 0 {
			avg = hist.Sum / float64(hist.Count)
		}
		stats.Latencies[k] = LatencyStats{
			Count:   hist.Count,
			AvgSec:  avg,
			Inf:     hist.Inf,
		}
		hist.Mu.Unlock()
	}

	return stats
}

// MetricsStats holds a snapshot of current metrics
type MetricsStats struct {
	RequestsTotal map[string]int64
	ErrorsTotal   map[string]int64
	Latencies    map[string]LatencyStats
}

// LatencyStats holds latency statistics for a single method
type LatencyStats struct {
	Count   int64
	AvgSec  float64
	Inf     int64
}

// globalMetrics is the singleton metrics instance
var globalMetrics = NewMetrics()

// RecordMetric is a convenience wrapper for globalMetrics.RecordRequest
func RecordMetric(method string, duration time.Duration, isError bool) {
	globalMetrics.RecordRequest(method, duration, isError)
}

// GetMetricsStats returns the current metrics snapshot
func GetMetricsStats() MetricsStats {
	return globalMetrics.GetStats()
}
