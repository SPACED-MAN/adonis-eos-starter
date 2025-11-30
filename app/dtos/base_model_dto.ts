/**
 * BaseModelDto
 *
 * Lightweight helper with convenience constructors used by DTOs.
 * We intentionally keep it framework-agnostic so DTOs are just
 * plain TypeScript classes.
 */
export abstract class BaseModelDto {
	/**
	 * Create a DTO instance from a single model.
	 */
	static from<T, M>(this: new (model?: M) => T, model: M | null | undefined): T | null {
		if (!model) return null
		return new this(model)
	}

	/**
	 * Create DTO instances from an array of models.
	 */
	static fromArray<T, M>(this: new (model?: M) => T, models: M[] | null | undefined): T[] {
		if (!models || models.length === 0) return []
		return models.map((model) => new this(model))
	}
}


