/*
  # Create oil changes tracking table

  1. New Tables
    - `oil_changes`
      - `id` (uuid, primary key)
      - `cliente` (text) - Cliente name
      - `vehiculo` (text) - Vehicle description
      - `placa` (text) - License plate
      - `kilometraje` (integer) - Current mileage
      - `aceite_usado` (text) - Oil type used
      - `fecha` (date) - Service date
      - `proximo_cambio` (integer) - Next service mileage
      - `completado` (boolean) - Status
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `oil_changes` table
    - Public read access for all records
    - Public insert/update/delete for all records
*/

CREATE TABLE IF NOT EXISTS oil_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente text NOT NULL,
  vehiculo text NOT NULL,
  placa text NOT NULL,
  kilometraje integer NOT NULL,
  aceite_usado text NOT NULL,
  fecha date NOT NULL,
  proximo_cambio integer NOT NULL,
  completado boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE oil_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON oil_changes FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert"
  ON oil_changes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update"
  ON oil_changes FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete"
  ON oil_changes FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_oil_changes_fecha ON oil_changes(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_oil_changes_placa ON oil_changes(placa);
CREATE INDEX IF NOT EXISTS idx_oil_changes_cliente ON oil_changes(cliente);