# Basic DOT-LD Example

This is the simplest possible DOT-LD document, demonstrating all three core syntax elements in a minimal working example.

## Purpose

This example shows how to:
- Define a basic ontology with entity types
- Reference entities in natural language text
- Create relationships between entities

## The Complete Example

```markdown
# Simple Web Application

::config
// Define our entity types with visual styling
system: round-rectangle, #2196F3, 100
database: rectangle, #4CAF50, 90
component: ellipse, #FF9800, 80

// Assign types to our specific entities
WebServer: type=system
UserDatabase: type=database
Cache: type=component
::

## Architecture Overview

Our application uses a [[WebServer]] to handle web requests from users. 
The [[WebServer]] stores user data in a [[UserDatabase]] for persistence
and uses a [[Cache]] to improve response times.

The cache helps reduce database load by storing frequently accessed data
in memory.

## System Relationships

::rel WebServer -> UserDatabase [stores_data_in] ::
::rel WebServer -> Cache [uses] ::
::rel Cache -> UserDatabase [reads_from] ::
```

## What This Creates

### Entities Defined

| Entity | Type | Visual Style |
|--------|------|--------------|
| WebServer | system | Blue round-rectangle (100px) |
| UserDatabase | database | Green rectangle (90px) |
| Cache | component | Orange ellipse (80px) |

### Relationships

1. **WebServer to UserDatabase** with label `stores_data_in`
   - The web server persists data to the database

2. **WebServer to Cache** with label `uses`
   - The web server leverages the cache for performance

3. **Cache to UserDatabase** with label `reads_from`
   - The cache populates its data from the database

## Key Concepts Demonstrated

### 1. Configuration Block

```markdown
::config
system: round-rectangle, #2196F3, 100
database: rectangle, #4CAF50, 90
component: ellipse, #FF9800, 80

WebServer: type=system
UserDatabase: type=database
Cache: type=component
::
```

### 2. Entity References

```markdown
The [[WebServer]] stores user data in a [[UserDatabase]]...
```

### 3. Relationship Notation

```markdown
::rel WebServer -> UserDatabase [stores_data_in] ::
::rel WebServer -> Cache [uses] ::
::rel Cache -> UserDatabase [reads_from] ::
```
