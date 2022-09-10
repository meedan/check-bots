# Twitter search bot

This bot waits on the `create_project_media` webhook. When a new item is created that is of type Claim (text) or Link, it queries an API with the title of the item.
The top three results are returned and added as a note to the object.

## Setup

Create a BotUser (b) and set it to listen to the `create_project_media` webhook
```b.set_events([{"event"=>"create_project_media", "graphql"=>"dbid, title, description, type"}])```




