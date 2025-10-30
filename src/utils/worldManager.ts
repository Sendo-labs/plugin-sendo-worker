import { IAgentRuntime, UUID, logger, createUniqueUuid } from '@elizaos/core';

/**
 * WorldManager
 *
 * Manages the permanent world for the agent and cleanup of temporary rooms.
 * Each agent has one permanent world that persists across analyses.
 */
export class WorldManager {
  constructor(private runtime: IAgentRuntime) {}

  /**
   * Ensure a permanent world exists for this agent
   * This world is used for all analyses and persists across restarts
   *
   * World ID format: sendo-agent-{agentId}
   */
  async ensureAgentWorldExists(): Promise<void> {
    try {
      const worldId = this.getAgentWorldId();
      const agentName = this.runtime.character?.name || 'Unknown Agent';

      // Check if world already exists to avoid duplicate key error
      const existingWorld = await this.runtime.getWorld(worldId);

      if (existingWorld) {
        logger.debug(`[WorldManager] Agent world already exists: ${worldId}`);
        return;
      }

      // Create the world
      await this.runtime.ensureWorldExists({
        id: worldId,
        name: `Sendo Agent World - ${agentName}`,
        agentId: this.runtime.agentId,
        serverId: 'sendo-worker',
        metadata: {
          type: 'sendo-agent',
          agentName,
          createdAt: Date.now(),
          permanent: true,
        },
      });

      logger.info(`[WorldManager] ✅ Agent world created: ${worldId}`);
    } catch (error: any) {
      logger.error('[WorldManager] Failed to ensure agent world:', error);
      throw error;
    }
  }

  /**
   * Get the permanent worldId for this agent
   * Used for all analysis operations
   */
  getAgentWorldId(): UUID {
    return createUniqueUuid(this.runtime, `sendo-agent-${this.runtime.agentId}`) as UUID;
  }

  /**
   * Cleanup temporary rooms created during analysis
   * The agent's world is kept permanent
   *
   * @param roomIds - Array of room IDs to cleanup
   */
  async cleanupAnalysisRooms(roomIds: UUID[]): Promise<void> {
    if (roomIds.length === 0) {
      return;
    }

    try {
      logger.debug(`[WorldManager] 🧹 Cleaning up ${roomIds.length} temporary rooms...`);

      // Delete each room
      for (const roomId of roomIds) {
        try {
          await this.runtime.deleteRoom(roomId);
        } catch (error: any) {
          // Individual room deletion failure is non-critical
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.warn(`[WorldManager] Failed to delete room ${roomId}: ${errorMsg}`);
        }
      }

      logger.info(`[WorldManager] ✅ Cleaned up ${roomIds.length} temporary rooms`);
    } catch (error: any) {
      logger.error('[WorldManager] Cleanup failed:', error);
      // Non-critical, don't throw
    }
  }
}
