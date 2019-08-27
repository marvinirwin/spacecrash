import { Room, Client } from "colyseus";
import { State, Path, BRUSH, DEFAULT_BRUSH } from "./State";
import { Player } from "./Player";
import { generateName } from "../utils/name_generator";
import Drawing from "../db/Drawing";

export class DrawingRoom extends Room<State> {
  autoDispose = false;
  lastChatMessages: string[] = [];

  onCreate(options) {
    this.setState(new State());

    this.state.countdown = options.expiration;
    this.setSimulationInterval(() => this.countdown(), 1000);
  }

  onJoin(client: Client, options: any) {
    const player = this.state.createPlayer(client.sessionId);
    player.name = options.name || generateName();

    this.lastChatMessages.forEach(chatMsg => this.send(client, ['chat', chatMsg]));
  }

  onMessage(client: Client, message: any) {
    const player: Player = this.state.players[client.sessionId];
    const [command, data] = message;

    // change angle
    if (command === "chat") {
      const chatMsg = `${player.name}: ${data}`;
      this.broadcast(['chat', chatMsg]);
      this.lastChatMessages.push(chatMsg);

      // prevent history from being 50+ messages long.
      if (this.lastChatMessages.length > 50) {
        this.lastChatMessages.shift();
      }

    } else if (this.state.countdown > 0) {
      if (command === "s") {
        // start path
        player.lastPath = new Path();
        player.lastPath.points.push(...data);
        player.lastPath.color = message[2];
        player.lastPath.brush = message[3] || DEFAULT_BRUSH;

      } else if (command === "p") {
        // path point
        player.lastPath.points.push(...data);

      } else if (command === "e") {
        // end path
        this.state.paths.push(player.lastPath);
      }
    }
  }

  countdown() {
    if (this.state.countdown > 0) {
      this.state.countdown--;

    } else if (!this.autoDispose) {
      this.autoDispose = true;
      this.resetAutoDisposeTimeout(5);
    }
  }

  onLeave(client: Client) {
    this.state.removePlayer(client.sessionId);
  }

  async onDispose() {
    // TODO: fill `userIds` and `usersCount`
    console.log("Disposing room, let's persist its result!");

    await Drawing.create({
      paths: this.state.paths,
      userIds: [],
      usersCount: 0,
      mode: this.roomName,
      votes: 0,
    });

  }

}
