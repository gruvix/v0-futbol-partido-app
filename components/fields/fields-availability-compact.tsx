"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DateNavigator } from "@/components/fields/date-navigator";
import { InlineLoader } from "@/components/football-loader";

import type {
  NormalizedAvailabilityResponse,
  NormalizedComplexAvailability,
} from "@/lib/fields/types";

function todayYYYYMMDD(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export interface FieldsAvailabilityCompactProps {
  /** If set, only this complex will be shown (e.g. "terrazas"). */
  complexId?: string;
  /** If set, date is controlled by parent (YYYY-MM-DD). */
  date?: string;
  /** Callback used when date is controlled by parent. */
  onDateChange?: (date: string) => void;
  /** Hide title/header for embedding inside a modal. */
  hideTitle?: boolean;
}

export function FieldsAvailabilityCompact({
  complexId,
  date: controlledDate,
  onDateChange,
  hideTitle = true,
}: FieldsAvailabilityCompactProps): React.JSX.Element {
  const [uncontrolledDate, setUncontrolledDate] = useState<string>(
    todayYYYYMMDD()
  );

  const date = controlledDate ?? uncontrolledDate;
  const setDate = onDateChange ?? setUncontrolledDate;

  const [data, setData] = useState<NormalizedAvailabilityResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      // Clear previous availability while loading new date
      setData(null);
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/fields/availability?date=${encodeURIComponent(date)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as NormalizedAvailabilityResponse;
        if (!cancelled) {
          setData(json);
          setHasLoadedOnce(true);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const complexes = useMemo((): NormalizedComplexAvailability[] => {
    const all = data?.complexes ?? [];
    if (!complexId) return all;
    return all.filter((c) => c.complexId === complexId);
  }, [data, complexId]);

  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-lg">
      {isLoading ? (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] bg-black/10" />
      ) : null}

      {isLoading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <InlineLoader size={hasLoadedOnce ? "md" : "lg"} />
        </div>
      ) : null}

      {!hideTitle ? (
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Disponibilidad
          </h2>
          <p className="text-xs font-medium text-muted-foreground">Canchas</p>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-3 flex flex-col gap-3">
          <DateNavigator date={date} onChange={setDate} />
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Cargando…</p>
          ) : null}
          {error ? <p className="text-xs text-destructive">Error: {error}</p> : null}
          {!isLoading && !error && complexes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No hay disponibilidad para mostrar.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {complexes.map((complex) => (
          <Card key={complex.complexId}>
            <CardContent className="p-3 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-foreground">
                    {complex.complexName}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {complex.date}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {complex.fields.map((field) => (
                  <div key={field.fieldId} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        {field.fieldName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {field.slots.length} horarios
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      {field.slots.map((slot) => {
                        const availableFieldsText =
                          slot.availableFieldNames &&
                          slot.availableFieldNames.length > 0
                            ? slot.availableFieldNames.join(", ")
                            : slot.available
                            ? "Disponible"
                            : "No disponible";

                        return (
                          <div
                            key={slot.time}
                            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                          >
                            <div className="flex items-center gap-3">
                              <Badge
                                variant={slot.available ? "default" : "secondary"}
                                className={slot.available ? "" : "opacity-70"}
                              >
                                {slot.time}
                              </Badge>
                              <span className="text-xs text-foreground">
                                {availableFieldsText}
                              </span>
                            </div>

                            {slot.price !== undefined ? (
                              <span className="text-[11px] text-muted-foreground">
                                ${slot.price}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
