# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js + React, deployed on Vercel to oosterhouse.wedding. Chosen by the couple over static HTML.

## Users

Primary users are invited wedding guests — family and friends of James and Hannah — who receive a save-the-date (link, QR, or spoken URL) and need to mark the weekend on a calendar. Many will open it on a phone. A secondary audience is the couple themselves, sharing a single canonical URL.

## Product Purpose

This is the public website for the James and Hannah (Oosterhouse) wedding. Version one exists to deliver a save-the-date: who is getting married, the date, and where, clearly enough that a guest can put July 4, 2027 on the calendar. Success is a guest who remembers the date and the lake venue, and can find the site again at oosterhouse.wedding. Later it may grow into the full wedding site; that is out of scope for v1.

## Positioning

This is James and Hannah’s own site on their own domain, not a hosted wedding-template page. Guests go to oosterhouse.wedding. The first ship is a save-the-date, not a planning portal.

## Operating Context

- GitHub: `jameso107/wedding` (public).
- Deploy: Vercel, custom domain `oosterhouse.wedding`.
- Guests arrive from a shared URL or QR; there is no login.
- The wedding is Sunday, July 4, 2027, at Bay Pointe Inn (branded Bay Pointe), 11456 Marsh Road, Shelbyville, Michigan, on the south shore of Gun Lake, between Grand Rapids and Kalamazoo.

## Capabilities and Constraints

Confirmed for v1:

- A single public save-the-date surface.
- Names, date, and venue are the payload.
- Motion is welcome; the couple asked for good animation.
- No RSVP, registry, travel block, story, or photo gallery in v1.

Open / undecided:

- Hannah’s last name as it should appear on the site.
- Name lockup on the site: Hannah + James.
- Ceremony vs. reception time, dress code, and which Bay Pointe space.
- Couple photography and other original assets (none on hand yet).
- When RSVP and later wedding-site sections will be added.

## Brand Commitments

- Couple: Hannah and James; the public lockup is Hannah + James. The wedding may also be referred to as the Oosterhouse wedding.
- Domain and public name: oosterhouse.wedding.
- Coastal theme.
- Color scheme: light blue and dark maroon.
- Animation is part of the identity, not decoration to strip later.

## Evidence on Hand

- Date: July 4, 2027.
- Venue: Bay Pointe Inn, Gun Lake, Shelbyville, Michigan (https://www.baypointeinn.com/).
- Postcard painting of Bay Pointe Inn on Gun Lake, provided by the couple (`public/images/bay-pointe.jpg`).
- No couple photographs, monograms, or stationery scans in the repo. Future work must not fabricate quotes, guest lists, or claims about the day that have not been confirmed.

## Product Principles

- The date and the place must be unmistakable in the first viewport.
- Prefer one canonical URL over a maze of pages.
- Do not pretend later features (RSVP, registry, travel) exist until they do.
- Keep guest effort near zero: open, understand, calendar, leave.
- Grow the site in public without invalidating the save-the-date.
