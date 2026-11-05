WHATNOT REST API LIST-RESPONSE FIX

Upload ONLY the extracted lib folder to the root of your Soul Analytics GitHub repository.
The updated file should appear at lib/whatnot.ts.

This patch changes one file. It handles Whatnot REST v2 list responses in the form
{ "data": [...], "next_cursor": "..." } and uses the cursor query parameter.

No new environment variables, API tokens, or Supabase changes are required.
The fix does not calculate revenue or profit. If the first sync still fails,
report the error shown in Whatnot Overview. It will include only the top-level
response's field names and the data field's type, not order or customer values.

Do not upload a nested project folder or the ZIP file itself.
