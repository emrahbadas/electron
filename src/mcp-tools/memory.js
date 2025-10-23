/**
 * MCP Memory / Knowledge Graph System
 * 
 * Implements the Memory Server specification from Claude MCP.
 * Stores entities, relations, and observations in JSONL format.
 * 
 * Storage Format: memory.jsonl
 * Each line is a JSON object: {"type": "entity", ...} or {"type": "relation", ...}
 * 
 * Specification: https://github.com/modelcontextprotocol/servers/blob/main/src/memory/index.ts
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const appendFileAsync = promisify(fs.appendFile);

/**
 * Entity Schema:
 * {
 *   type: 'entity',
 *   name: string,           // Unique identifier
 *   entityType: string,     // Category: 'session', 'file', 'tool', 'error', etc.
 *   observations: string[]  // Facts about this entity
 * }
 * 
 * Relation Schema:
 * {
 *   type: 'relation',
 *   from: string,          // Entity name
 *   to: string,            // Entity name
 *   relationType: string   // 'depends_on', 'creates', 'fixes', 'calls', etc.
 * }
 */

class KnowledgeGraphManager {
  constructor(memoryFilePath) {
    this.memoryFilePath = memoryFilePath || path.join(__dirname, '../../memory.jsonl');
    this.cache = null; // { entities: [], relations: [] }
    this.cacheTimestamp = 0;
    this.cacheTTL = 5000; // 5 seconds
  }

  /**
   * Initialize memory file if it doesn't exist
   */
  async initialize() {
    try {
      await fs.promises.access(this.memoryFilePath);
    } catch {
      // File doesn't exist, create empty file
      await writeFileAsync(this.memoryFilePath, '', 'utf8');
      console.log(`[Memory] Created new memory file: ${this.memoryFilePath}`);
    }
  }

  /**
   * Load entire knowledge graph from JSONL file
   * 
   * @private
   * @returns {Promise<{entities: Entity[], relations: Relation[]}>}
   */
  async loadGraph() {
    // Check cache first
    const now = Date.now();
    if (this.cache && (now - this.cacheTimestamp) < this.cacheTTL) {
      return this.cache;
    }

    try {
      const data = await readFileAsync(this.memoryFilePath, 'utf8');
      const lines = data.split('\n').filter(line => line.trim() !== '');
      
      const graph = {
        entities: [],
        relations: []
      };

      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          if (item.type === 'entity') {
            graph.entities.push({
              name: item.name,
              entityType: item.entityType,
              observations: item.observations || []
            });
          } else if (item.type === 'relation') {
            graph.relations.push({
              from: item.from,
              to: item.to,
              relationType: item.relationType
            });
          }
        } catch (parseError) {
          console.error(`[Memory] Corrupted line in memory file: ${line}`, parseError);
          // Continue parsing other lines
        }
      }

      // Update cache
      this.cache = graph;
      this.cacheTimestamp = now;

      return graph;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet
        return { entities: [], relations: [] };
      }
      throw error;
    }
  }

  /**
   * Save entire knowledge graph to JSONL file
   * 
   * @private
   * @param {{entities: Entity[], relations: Relation[]}} graph
   */
  async saveGraph(graph) {
    const lines = [
      ...graph.entities.map(e => JSON.stringify({
        type: 'entity',
        name: e.name,
        entityType: e.entityType,
        observations: e.observations
      })),
      ...graph.relations.map(r => JSON.stringify({
        type: 'relation',
        from: r.from,
        to: r.to,
        relationType: r.relationType
      }))
    ];

    await writeFileAsync(this.memoryFilePath, lines.join('\n') + '\n', 'utf8');
    
    // Invalidate cache
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * create_entities
   * 
   * Create multiple new entities in the knowledge graph.
   * Duplicate entities (same name) are skipped.
   * 
   * @param {Object} params
   * @param {Array<{name: string, entityType: string, observations: string[]}>} params.entities
   * @returns {Promise<Array<Entity>>} Newly created entities (excludes duplicates)
   */
  async createEntities(params) {
    const { entities } = params;

    if (!entities || !Array.isArray(entities)) {
      throw new Error('Invalid parameter: entities must be an array');
    }

    const graph = await this.loadGraph();
    const existingNames = new Set(graph.entities.map(e => e.name));
    
    const newEntities = entities.filter(e => {
      // Validation
      if (!e.name || !e.entityType) {
        console.warn('[Memory] Skipping invalid entity:', e);
        return false;
      }
      // Duplicate check
      if (existingNames.has(e.name)) {
        console.log(`[Memory] Entity already exists: ${e.name}`);
        return false;
      }
      return true;
    });

    if (newEntities.length === 0) {
      return [];
    }

    // Add to graph
    graph.entities.push(...newEntities.map(e => ({
      name: e.name,
      entityType: e.entityType,
      observations: e.observations || []
    })));

    await this.saveGraph(graph);

    console.log(`[Memory] Created ${newEntities.length} entities`);
    return newEntities;
  }

  /**
   * create_relations
   * 
   * Create multiple new relations between entities.
   * Duplicate relations are skipped.
   * 
   * @param {Object} params
   * @param {Array<{from: string, to: string, relationType: string}>} params.relations
   * @returns {Promise<Array<Relation>>} Newly created relations
   */
  async createRelations(params) {
    const { relations } = params;

    if (!relations || !Array.isArray(relations)) {
      throw new Error('Invalid parameter: relations must be an array');
    }

    const graph = await this.loadGraph();
    const existingEntityNames = new Set(graph.entities.map(e => e.name));

    const newRelations = relations.filter(r => {
      // Validation
      if (!r.from || !r.to || !r.relationType) {
        console.warn('[Memory] Skipping invalid relation:', r);
        return false;
      }

      // Check if entities exist
      if (!existingEntityNames.has(r.from)) {
        console.warn(`[Memory] Relation source entity not found: ${r.from}`);
        return false;
      }
      if (!existingEntityNames.has(r.to)) {
        console.warn(`[Memory] Relation target entity not found: ${r.to}`);
        return false;
      }

      // Duplicate check
      const isDuplicate = graph.relations.some(existing =>
        existing.from === r.from &&
        existing.to === r.to &&
        existing.relationType === r.relationType
      );

      if (isDuplicate) {
        console.log(`[Memory] Relation already exists: ${r.from} -[${r.relationType}]-> ${r.to}`);
        return false;
      }

      return true;
    });

    if (newRelations.length === 0) {
      return [];
    }

    graph.relations.push(...newRelations);
    await this.saveGraph(graph);

    console.log(`[Memory] Created ${newRelations.length} relations`);
    return newRelations;
  }

  /**
   * add_observations
   * 
   * Add new observations to existing entities.
   * Duplicate observations are skipped.
   * 
   * @param {Object} params
   * @param {Array<{entityName: string, contents: string[]}>} params.observations
   * @returns {Promise<Array<{entityName: string, addedObservations: string[]}>>}
   */
  async addObservations(params) {
    const { observations } = params;

    if (!observations || !Array.isArray(observations)) {
      throw new Error('Invalid parameter: observations must be an array');
    }

    const graph = await this.loadGraph();
    const results = [];

    for (const obs of observations) {
      const entity = graph.entities.find(e => e.name === obs.entityName);
      
      if (!entity) {
        console.warn(`[Memory] Entity not found: ${obs.entityName}`);
        continue;
      }

      const newObservations = obs.contents.filter(content =>
        !entity.observations.includes(content)
      );

      if (newObservations.length > 0) {
        entity.observations.push(...newObservations);
        results.push({
          entityName: obs.entityName,
          addedObservations: newObservations
        });
      }
    }

    if (results.length > 0) {
      await this.saveGraph(graph);
      console.log(`[Memory] Added observations to ${results.length} entities`);
    }

    return results;
  }

  /**
   * delete_entities
   * 
   * Delete multiple entities and their associated relations.
   * 
   * @param {Object} params
   * @param {string[]} params.entityNames
   */
  async deleteEntities(params) {
    const { entityNames } = params;

    if (!entityNames || !Array.isArray(entityNames)) {
      throw new Error('Invalid parameter: entityNames must be an array');
    }

    const graph = await this.loadGraph();
    const nameSet = new Set(entityNames);

    // Remove entities
    const beforeCount = graph.entities.length;
    graph.entities = graph.entities.filter(e => !nameSet.has(e.name));
    const deletedCount = beforeCount - graph.entities.length;

    // Remove relations involving deleted entities
    const beforeRelCount = graph.relations.length;
    graph.relations = graph.relations.filter(r =>
      !nameSet.has(r.from) && !nameSet.has(r.to)
    );
    const deletedRelCount = beforeRelCount - graph.relations.length;

    await this.saveGraph(graph);

    console.log(`[Memory] Deleted ${deletedCount} entities, ${deletedRelCount} relations`);
  }

  /**
   * delete_observations
   * 
   * Delete specific observations from entities.
   * 
   * @param {Object} params
   * @param {Array<{entityName: string, observations: string[]}>} params.deletions
   */
  async deleteObservations(params) {
    const { deletions } = params;

    if (!deletions || !Array.isArray(deletions)) {
      throw new Error('Invalid parameter: deletions must be an array');
    }

    const graph = await this.loadGraph();
    let totalDeleted = 0;

    for (const del of deletions) {
      const entity = graph.entities.find(e => e.name === del.entityName);
      
      if (!entity) {
        console.warn(`[Memory] Entity not found: ${del.entityName}`);
        continue;
      }

      const beforeCount = entity.observations.length;
      entity.observations = entity.observations.filter(obs =>
        !del.observations.includes(obs)
      );
      totalDeleted += (beforeCount - entity.observations.length);
    }

    if (totalDeleted > 0) {
      await this.saveGraph(graph);
      console.log(`[Memory] Deleted ${totalDeleted} observations`);
    }
  }

  /**
   * delete_relations
   * 
   * Delete multiple relations from the knowledge graph.
   * 
   * @param {Object} params
   * @param {Array<{from: string, to: string, relationType: string}>} params.relations
   */
  async deleteRelations(params) {
    const { relations } = params;

    if (!relations || !Array.isArray(relations)) {
      throw new Error('Invalid parameter: relations must be an array');
    }

    const graph = await this.loadGraph();
    const beforeCount = graph.relations.length;

    graph.relations = graph.relations.filter(r =>
      !relations.some(delRel =>
        r.from === delRel.from &&
        r.to === delRel.to &&
        r.relationType === delRel.relationType
      )
    );

    const deletedCount = beforeCount - graph.relations.length;

    if (deletedCount > 0) {
      await this.saveGraph(graph);
      console.log(`[Memory] Deleted ${deletedCount} relations`);
    }
  }

  /**
   * read_graph
   * 
   * Read the entire knowledge graph.
   * 
   * @returns {Promise<{entities: Entity[], relations: Relation[]}>}
   */
  async readGraph() {
    return await this.loadGraph();
  }

  /**
   * search_nodes
   * 
   * Search for nodes in the knowledge graph based on a query.
   * Searches entity names, types, and observation content.
   * 
   * @param {Object} params
   * @param {string} params.query - Search query (case-insensitive)
   * @returns {Promise<{entities: Entity[], relations: Relation[]}>}
   */
  async searchNodes(params) {
    const { query } = params;

    if (!query || typeof query !== 'string') {
      throw new Error('Invalid parameter: query must be a string');
    }

    const graph = await this.loadGraph();
    const lowerQuery = query.toLowerCase();

    // Filter entities
    const filteredEntities = graph.entities.filter(e =>
      e.name.toLowerCase().includes(lowerQuery) ||
      e.entityType.toLowerCase().includes(lowerQuery) ||
      e.observations.some(obs => obs.toLowerCase().includes(lowerQuery))
    );

    // Get entity names for relation filtering
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));

    // Filter relations (only between filtered entities)
    const filteredRelations = graph.relations.filter(r =>
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    return {
      entities: filteredEntities,
      relations: filteredRelations
    };
  }

  /**
   * open_nodes
   * 
   * Open specific nodes in the knowledge graph by their names.
   * 
   * @param {Object} params
   * @param {string[]} params.names - Entity names to retrieve
   * @returns {Promise<{entities: Entity[], relations: Relation[]}>}
   */
  async openNodes(params) {
    const { names } = params;

    if (!names || !Array.isArray(names)) {
      throw new Error('Invalid parameter: names must be an array');
    }

    const graph = await this.loadGraph();
    const nameSet = new Set(names);

    // Get requested entities
    const entities = graph.entities.filter(e => nameSet.has(e.name));

    // Get relations between requested entities
    const relations = graph.relations.filter(r =>
      nameSet.has(r.from) && nameSet.has(r.to)
    );

    return { entities, relations };
  }

  /**
   * Get memory statistics
   * 
   * @returns {Promise<{entityCount: number, relationCount: number, observationCount: number, fileSize: number}>}
   */
  async getStats() {
    const graph = await this.loadGraph();
    const stats = await fs.promises.stat(this.memoryFilePath);
    
    const observationCount = graph.entities.reduce(
      (sum, e) => sum + e.observations.length,
      0
    );

    return {
      entityCount: graph.entities.length,
      relationCount: graph.relations.length,
      observationCount,
      fileSize: stats.size
    };
  }
}

module.exports = { KnowledgeGraphManager };
