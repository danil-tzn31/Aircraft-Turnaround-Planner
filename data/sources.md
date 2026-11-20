# Data sources

Durations are approximate and rounded to whole minutes. Not for operational use.

## Airbus A320neo (A320)
- Airbus, Aircraft Characteristics - Airport and Maintenance Planning (AC), A320, revision 46, Jul 01/26
- Section 5-2-0, Full Servicing Turn Round Time Chart (figure 5-2-0-991-006-A01), A320-200 / A320neo
- Airbus assumes 150 passengers through one bridge at door 1L: deplaning 20 pax/min, boarding 12 pax/min, plus 2 min for last-passenger seating and headcount. I kept those rates and applied them to the 188 seats of Cebu Pacific's A320neo (Cebu also flies some A320neos with 194 seats and older A320ceos with 180; the app uses the 188-seat layout). Two-door times split the passengers evenly across two doors.
- Fuelling: 20,000 l, one hose, about 16 min pumping plus connect/disconnect. Airbus assumes no refuelling with passengers on board.
- Catering: one truck, front galley (4 trolleys) then rear galley (7 trolleys) at 1.2 min per trolley, with 2 min to drive between doors.
- Baggage: 2 cargo loaders, 1.5 min per container.
- Cleaning is done "in available time" in the chart, so its duration here is my estimate.

## Airbus A321neo (A21N)
- Airbus, Aircraft Characteristics - Airport and Maintenance Planning (AC), A321, revision 35, Jul 01/26
- Section 5-2-0, Full Servicing Turn Round Time Chart (figure 5-2-0-991-007-A01), A321-100 / A321-200 / A321neo
- Same passenger rates as the A320 (Airbus assumes 185 passengers), applied to Cebu Pacific's 236 seats.
- Fuelling: 20,000 l, about 14 min pumping plus connect/disconnect.
- Catering: front galley 4 trolleys, rear galley 10 trolleys.
- Ground equipment other than the bridge starts 1 min after on-block.
- Cleaning duration is my estimate.

## Airbus A330neo (A339)
- Airbus, Aircraft Characteristics - Airport and Maintenance Planning (AC), A330, revision 34, Dec 01/25
- Section 5-2-0, Full Servicing Turn Round Time Chart (figure 5-2-0-991-001-B01), A330-300 / A330-900
- Airbus assumes 300 passengers through two bridges (doors 1L and 2L): deplaning 25 pax/min per door, boarding 15 pax/min per door, plus 4 min for last-passenger seating and headcount. Applied to Cebu Pacific's 459 seats. One-door times put everyone through a single door.
- Two-door boarding is the default for this type, since that's how Airbus plans the turn.
- Fuelling: 90,000 l through a hydrant with 2 hoses, about 34 min pumping. Hydrant positioning and connection (8 min) happens while passengers leave, then 8 min to disconnect and remove.
- Catering: three trucks working at the same time; the rear galley (22 trolleys at 1.5 min each) sets the time.
- Baggage and cargo: 18 containers in the forward hold, 1.2 min each to unload and 1.4 min to load.
- Cleaning duration is my estimate.

## ATR 72-600 (AT76)
- No public ATR turnaround chart used. All durations are estimates for 78 passengers boarding through the rear door, using the same passenger rates as above.
- To do: replace with figures from ATR airport planning documentation if I find it.

## Not taken from the documents
- Seat counts are Cebu Pacific's published cabin configurations.
- Default scheduled ground times (`default_ground`) are app defaults, not airline schedules.
