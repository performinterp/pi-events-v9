# COMPREHENSIVE ARCHITECTURE PLAN: PI Events App Transformation
**From Catalogue → Empowerment Tool**

[Full architecture plan saved - see Task agent output above for complete details]

## Quick Reference

### 3 Core Flows
1. **Events with BSL** - Enhanced catalogue (confirmed interpreters only)
2. **Check BSL Booking** - Search any event for interpreter status
3. **Request BSL** - Advocacy form with pre-written messages

### Badge System
- 🟢 **Green**: Interpreter booked (confirmed)
- 🟠 **Orange**: Request possible (venue contactable)
- 🔴 **Red**: No interpreter (advocacy needed)

### Implementation Phases
1. Foundation (badge system, routing, legal compliance)
2. Flow 1 Enhancement (visual cards, event details)
3. Onboarding (first-time user education)
4. Flow Navigation Hub (home screen)
5. Flow 2 - Check BSL (search interface)
6. Flow 3 - Request BSL (advocacy form)
7. Polish & Testing
8. Deployment

### Key Technical Decisions
- **Routing**: Hash-based (vanilla JS, no build tools)
- **Badge Logic**: Client-side calculation from event data
- **Search**: Fuzzy matching, client-side, offline-capable
- **Messages**: JavaScript template library
- **Legal Compliance**: INTERPRETER_CONFIRMED filter

See full plan for implementation details.
