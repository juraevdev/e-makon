import type { Service } from "@/lib/api/types";

export function ServiceThumb({
  service,
  className = "h-14 w-16",
}: {
  service: Pick<Service, "image" | "icon" | "emoji" | "name">;
  className?: string;
}) {
  if (service.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={service.image}
        alt={service.name}
        loading="lazy"
        className={`${className} shrink-0 rounded-xl border border-[#26352c] object-cover`}
      />
    );
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-xl border border-[#26352c] bg-primary-container/20 text-primary`}
    >
      {service.emoji ? (
        <span className="text-xl">{service.emoji}</span>
      ) : (
        <span className="material-symbols-outlined">{service.icon || "eco"}</span>
      )}
    </span>
  );
}
