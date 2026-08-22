# Valet Admin UI Asset Pack

Purpose:
Reusable visual assets for a premium mobile-first valet parking operations app.

Folders:
- icons/          UI icons and action symbols
- illustrations/  dashboard/empty-state/operation illustrations
- parking/        parking-slot state assets

Design direction:
- Neutral black/white/soft-gray base
- Green for available/success/live states
- Amber for reserved/warning
- Blue for retrieval/in-progress
- SVG-first so assets remain sharp at any resolution

Recommended usage:
- Dashboard: parking_garage.svg
- Park action: park.svg
- Retrieve action: retrieve.svg
- Driver/valet: valet.svg
- Vehicle workflow: car.svg / valet_operation.svg
- Parking map: parking/*.svg
- Empty state: empty_parking.svg

Do not treat these as a substitute for the parking map itself. The actual parking map should be rendered as a responsive React component so slot status remains live and interactive.
