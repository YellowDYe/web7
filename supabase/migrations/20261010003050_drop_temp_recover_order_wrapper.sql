/*
# Drop temporary order recovery wrapper

Removes the temporary _temp_recover_order function used to recover Franco Guerrero's
order. No security or schema changes.
*/

DROP FUNCTION IF EXISTS public._temp_recover_order(uuid, text, numeric);
