export type WorkflowStateRef = {
  id: string;
  key: string;
  isTerminal: boolean;
};

export type WorkflowTransitionRef = {
  fromStateId: string;
  toStateId: string;
};

export class WorkflowEngine {
  constructor(
    private readonly states: WorkflowStateRef[],
    private readonly transitions: WorkflowTransitionRef[],
  ) {}

  canTransition(fromStateId: string, toStateId: string): boolean {
    if (fromStateId === toStateId) return false;
    return this.transitions.some(
      (t) => t.fromStateId === fromStateId && t.toStateId === toStateId,
    );
  }

  getState(stateId: string): WorkflowStateRef | undefined {
    return this.states.find((s) => s.id === stateId);
  }

  isTerminal(stateId: string): boolean {
    return this.getState(stateId)?.isTerminal ?? false;
  }
}
