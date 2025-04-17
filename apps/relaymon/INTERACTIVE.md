# RelayMon Interactive Mode

This document describes how to use the interactive mode of RelayMon, which provides a TUI (Text-based User Interface) for managing and monitoring Nostr relays.

## Running Interactive Mode

To start RelayMon in interactive mode, run:

```bash
deno task interactive
```

Or using the regular RelayMon with the -i flag:

```bash
deno run --allow-all index.ts -i
```

## Navigation

Navigation in the interactive interface is done using the keyboard:

- **Arrow Up/Down**: Move selection up or down
- **Enter**: Select the highlighted option
- **Escape**: Go back to the previous menu or exit if at the main menu
- **PageUp/PageDown**: Navigate quickly through lists
- **F**: Filter the current list (in relay views)
- Various hotkeys are displayed in each menu (like S for save, D for delete, etc.)

## Available Menus

### 1. Main Menu

The main menu provides access to all features:

- **Run Monitor**: Start the relay monitoring process
- **Configuration**: View and edit configuration values
- **Ignored Relays**: Manage relays that are currently ignored
- **All Relays**: Browse and manage all relays in the database

### 2. Run Monitor

This menu shows the status of the monitoring process and allows you to:

- **Start the monitor** if it's not running
- **Stop the monitor** with the 'S' key
- **Restart the monitor** with the 'R' key
- Press **Escape** to return to the main menu while keeping the monitor running in the background

The monitor runs in a background process and logs are captured separately. The PID of the monitor process is displayed when available, making it easier to track.

### 3. Configuration

The configuration editor allows you to navigate and edit the YAML configuration:

- **Navigate through nested objects** by selecting them and pressing Enter
- **Edit primitive values** (strings, numbers, booleans) by selecting them and pressing Enter
- **Add new items** to objects or arrays with the 'A' key
- **Delete items** with the 'D' key
- **Save changes** to the configuration file with the 'S' key
- **Navigate back up** through the configuration hierarchy with Escape
- A **breadcrumb trail** at the top shows your current location in the config structure

When editing values:
- **Enter** to save changes
- **Escape** to cancel editing
- **Arrow Left/Right** to move the cursor within the text
- **Home/End** to move cursor to beginning/end of text
- **Backspace** to delete the character before the cursor
- **Delete** to delete the character at the cursor position
- The text editor includes a bounding box and blinking cursor for better visibility

### 4. Ignored Relays

Manage relays that are currently ignored by RelayMon:

- Browse the list of ignored relays
- **Filter the list** by pressing 'F' and typing part of a relay URL
- **Unignore** selected relays by pressing Enter
- **Delete** relays from the database with the 'D' key
- **PageUp/PageDown** to navigate through pages of relays
- The currently selected relay is highlighted for better visibility
- Scrollable interface with indicators when more relays are available above/below
- Pagination information shows which relays are currently visible

### 5. All Relays

View and manage all relays in the database:

- Browse all relays with status indicators (online ✓ or offline ✗)
- **Filter the list** by pressing 'F' and typing part of a relay URL
- See additional information like network type and last checked date
- **Toggle ignore status** for selected relays (Enter)
- **Change sort field** (S) - sort by URL, online status, network, check date, etc.
- **Toggle sort direction** (D) - ascending or descending
- **Toggle grouping** (G) - group by network, online status, etc.
- **Delete** relays from the database (Delete key)
- **PageUp/PageDown** to navigate through pages of relays
- The currently selected relay is highlighted for better visibility
- Scrollable interface with indicators when more relays are available above/below
- Pagination information shows which relays are currently visible

The relay view supports grouping to help organize large numbers of relays, with a count of relays in each group.

## Pagination and Navigation

In list views (Ignored Relays and All Relays):

- The interface shows which items you're currently viewing (e.g., "Showing 1-15 of 42 relays")
- Use **PageUp** and **PageDown** keys to quickly move between pages
- Arrow keys navigate between individual items
- Visual indicators show when there are more items above or below the current view

## Filtering

In both the Ignored Relays and All Relays views:

1. Press **F** to enter filter mode
2. Type your search term (case-insensitive)
3. Press **Enter** or **Escape** to apply the filter and exit filter mode
4. The filter will be shown at the top of the screen
5. Press **F** again to modify the filter
6. The total number of filtered items is displayed in the menu title

Filtering allows you to quickly find specific relays in large lists.

## Keyboard Input

The interactive mode now supports proper keyboard input for all standard ASCII characters, which allows you to:

- Type any character when filtering or editing configuration values
- Use arrow keys for navigation and cursor positioning
- Use special keys like PageUp, PageDown, Home, End, Backspace, and Delete
- Properly edit text with cursor positioning

## Customization

The interactive mode uses the same configuration file as the regular RelayMon, but allows for more dynamic interaction with the data. Any changes made through the configuration editor are saved to the specified config file and will be used the next time RelayMon is run. 