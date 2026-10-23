// Date helpers for "YYYY-MM-DD" calendar dates.
//
// Never use `date.toISOString().split("T")[0]` for a calendar date: that
// converts to UTC first, so in IST (UTC+5:30) anything between 00:00 and
// 05:30 local time comes out as the *previous* day. Likewise
// `new Date("YYYY-MM-DD")` parses as UTC midnight, which shows as the
// previous day in negative-offset timezones.

// Date -> "YYYY-MM-DD" using the browser's local calendar day.
export const toLocalYMD = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
};

// "YYYY-MM-DD" -> Date at local midnight of that day.
export const parseYMD = (str) => {
  const [y, m, d] = String(str).split("-").map(Number);

  return new Date(y, m - 1, d);
};
