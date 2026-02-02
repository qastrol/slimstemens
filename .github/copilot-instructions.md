# De Slimste Mens - Copilot Instructions

## Project Overview
"De Slimste Mens" is a Dutch game show simulation built with Node.js, featuring real-time multiplayer gameplay through WebSockets. The application consists of a host interface (`index.html`) and a display interface (`display.html`) for audience viewing.

## Architecture
- **Backend**: Node.js server (`server.js`) with WebSocket support (`websocket.js`)
- **Frontend**: HTML/CSS/JavaScript with modular round implementations
- **Communication**: WebSocket for real-time updates between host and display
- **Audio**: SFX system for sound effects during gameplay

## File Structure Conventions
- `js/`: JavaScript modules for game logic and rounds
  - `core.js`: Core game mechanics
  - `round-*.js`: Specific round implementations
  - `vragen-*.js`: Question data for each round
- `css/`: Stylesheets for different views
  - `index.css`: Host interface styling
  - `display.css`: Display interface styling
  - `display-*.css`: Round-specific display styles
- `assets/`: Static assets
- `SFX/`: Sound effect files
- `galerij/`: Gallery content for rounds

## Coding Conventions
- **Language**: Dutch for UI text and comments
- **JavaScript**: ES6+ features, modular structure
- **HTML**: Semantic markup with Dutch content
- **CSS**: Component-based styling with round-specific overrides
- **Naming**: Descriptive Dutch names for functions and variables

## Development Workflow
1. Start server: Run `start_server.bat` or `node server.js`
2. Host interface: Open `index.html` in browser
3. Display interface: Open `display.html` in separate browser/tab
4. Test rounds: Use host controls to simulate gameplay

## Key Integration Points
- **WebSocket Events**: Handle real-time communication in `websocket.js`
- **Round Management**: Implement new rounds by adding to `roundsSequence` array and creating corresponding files
- **Question Data**: Add questions to `vragen-*.js` files following existing format
- **SFX Integration**: Use `playSFX()` function for audio feedback
- **Timer Logic**: Implement per-round timers in round-specific JavaScript files

## Testing
- Manual testing through browser interfaces
- Simulate full game flow using host controls
- Verify WebSocket communication between interfaces
- Test audio playback and visual transitions

## Deployment
- Local development: Use `start_server.bat` for quick setup
- Production: Ensure Node.js dependencies are installed via `npm install`
- Recommended display resolution: 1920x1080 for `display.html`