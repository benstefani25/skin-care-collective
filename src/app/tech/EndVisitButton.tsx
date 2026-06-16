"use client";

// Completion guard (T1-8): if the tech taps "End visit" while some booked
// appointments are still un-actioned (not completed, not no-show), confirm
// before ending rather than silently completing the visit.
export function EndVisitButton({
  action,
  visitId,
  unfinished,
}: {
  action: (formData: FormData) => void;
  visitId: string;
  unfinished: number;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          unfinished > 0 &&
          !window.confirm(
            `You have ${unfinished} member${unfinished === 1 ? "" : "s"} not yet marked done — end the visit anyway?`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="visit_id" value={visitId} />
      <button className="btn secondary" type="submit">
        End visit
      </button>
    </form>
  );
}
