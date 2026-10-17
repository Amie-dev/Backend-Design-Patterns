export type MetricLabels = Record<string, string | number | boolean>;

type CounterSeries = {
  labels: MetricLabels;
  value: number;
};

type HistogramSeries = {
  labels: MetricLabels;
  buckets: readonly number[];
  counts: number[];
  count: number;
  sum: number;
};

const DEFAULT_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5] as const;

function labelKey(labels: MetricLabels): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",");
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function formatLabels(labels: MetricLabels, extra?: Record<string, string>): string {
  const entries = [
    ...Object.entries(labels).map(([key, value]) => [key, String(value)] as const),
    ...Object.entries(extra ?? {}),
  ];

  if (entries.length === 0) return "";

  return `{${entries
    .map(([key, value]) => `${key}="${escapeLabel(value)}"`)
    .join(",")}}`;
}

/**
 * Dependency-free Prometheus registry.
 *
 * Swap it for `prom-client` in a real service: the service only calls
 * `increment`/`observe`, so the adapter is replaceable.
 */
export class MetricsRegistry {
  private readonly counters = new Map<string, Map<string, CounterSeries>>();
  private readonly histograms = new Map<string, Map<string, HistogramSeries>>();

  increment(name: string, labels: MetricLabels = {}, amount = 1): void {
    const seriesKey = labelKey(labels);
    let series = this.counters.get(name);

    if (!series) {
      series = new Map();
      this.counters.set(name, series);
    }

    const existing = series.get(seriesKey);
    if (existing) {
      existing.value += amount;
    } else {
      series.set(seriesKey, { labels: { ...labels }, value: amount });
    }
  }

  observe(
    name: string,
    value: number,
    labels: MetricLabels = {},
    buckets: readonly number[] = DEFAULT_BUCKETS,
  ): void {
    const seriesKey = labelKey(labels);
    let series = this.histograms.get(name);

    if (!series) {
      series = new Map();
      this.histograms.set(name, series);
    }

    let existing = series.get(seriesKey);
    if (!existing) {
      existing = {
        labels: { ...labels },
        buckets,
        counts: buckets.map(() => 0),
        count: 0,
        sum: 0,
      };
      series.set(seriesKey, existing);
    }

    buckets.forEach((bucket, index) => {
      if (value <= bucket) existing.counts[index] += 1;
    });
    existing.count += 1;
    existing.sum += value;
  }

  counterValue(name: string, labels: MetricLabels = {}): number {
    return this.counters.get(name)?.get(labelKey(labels))?.value ?? 0;
  }

  histogramCount(name: string, labels: MetricLabels = {}): number {
    return this.histograms.get(name)?.get(labelKey(labels))?.count ?? 0;
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }

  render(): string {
    const lines: string[] = [];

    for (const name of [...this.counters.keys()].sort()) {
      lines.push(`# TYPE ${name} counter`);
      for (const series of this.counters.get(name)!.values()) {
        lines.push(`${name}${formatLabels(series.labels)} ${series.value}`);
      }
    }

    for (const name of [...this.histograms.keys()].sort()) {
      lines.push(`# TYPE ${name} histogram`);
      for (const series of this.histograms.get(name)!.values()) {
        series.buckets.forEach((bucket, index) => {
          lines.push(
            `${name}_bucket${formatLabels(series.labels, { le: String(bucket) })} ${series.counts[index]}`,
          );
        });
        lines.push(
          `${name}_bucket${formatLabels(series.labels, { le: "+Inf" })} ${series.count}`,
        );
        lines.push(`${name}_sum${formatLabels(series.labels)} ${series.sum}`);
        lines.push(`${name}_count${formatLabels(series.labels)} ${series.count}`);
      }
    }

    return `${lines.join("\n")}\n`;
  }
}
