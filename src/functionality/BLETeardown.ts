// Centralized teardown state — prevents all 4 crash causes
class TeardownGuard {
  private _active = false;
  private _mountedCallbacks = new Set<() => void>();

  // Call this at the START of any disconnect sequence
  begin() {
    this._active = true;
    console.log('[TeardownGuard] Teardown begun — data callbacks silenced');
  }

  // Call this at the END of disconnect sequence
  end() {
    this._active = false;
    console.log('[TeardownGuard] Teardown complete — callbacks restored');
  }

  // Wrap every data callback with this
  get isTearingDown() {
    return this._active;
  }

  // Safe setState — only fires if teardown is not active
  safeSetState(setter: () => void) {
    if (!this._active) {
      setter();
    }
  }
}

export const teardownGuard = new TeardownGuard();
