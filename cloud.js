(() => {
  const CONFIG = window.LOOPD_SUPABASE_CONFIG || {};
  const isConfigured =
    CONFIG.url &&
    CONFIG.publishableKey &&
    !CONFIG.url.startsWith("COLE_AQUI") &&
    !CONFIG.publishableKey.startsWith("COLE_AQUI");

  const state = {
    client: null,
    user: null,
    syncTimer: null,
    syncing: false,
    applyingCloud: false,
    initialized: false,
  };

  const STORAGE = {
    associatedUser: "loopd-cloud-user-id",
    lastSync: "loopd-last-cloud-sync",
  };

  function getLocalReviews() {
    try {
      return JSON.parse(localStorage.getItem("reviews")) || [];
    } catch {
      return [];
    }
  }

  function getLocalSettings() {
    return {
      ratingScale: window.getRatingScale ? window.getRatingScale() : (localStorage.getItem("rating-scale") || "5"),
      autoCalculateRating: localStorage.getItem("auto-calculate-rating") || "desativado",
      libraryLayout: localStorage.getItem("library-layout") || "grid",
    };
  }

  function applySettings(settings = {}) {
    if (settings.ratingScale) localStorage.setItem("rating-scale", settings.ratingScale);
    if (settings.autoCalculateRating) localStorage.setItem("auto-calculate-rating", settings.autoCalculateRating);
    if (settings.libraryLayout) localStorage.setItem("library-layout", settings.libraryLayout);
  }

  function reviewKey(review) {
    if (review?.id) return `id:${review.id}`;
    return `fallback:${String(review?.album || "").toLowerCase()}::${String(review?.artista || "").toLowerCase()}`;
  }

  // Usado somente na primeira migração de um navegador com dados locais antigos.
  // Mantém itens exclusivos dos dois lados e, em duplicatas, preserva a versão local.
  function mergeLegacyReviews(cloudReviews = [], localReviews = []) {
    const merged = new Map();
    cloudReviews.forEach((review) => merged.set(reviewKey(review), review));
    localReviews.forEach((review) => merged.set(reviewKey(review), review));
    return Array.from(merged.values());
  }

  function setLocalData(reviews, settings) {
    state.applyingCloud = true;
    try {
      localStorage.setItem("reviews", JSON.stringify(Array.isArray(reviews) ? reviews : []));
      applySettings(settings || {});
    } finally {
      state.applyingCloud = false;
    }
  }

  function refreshAppFromStorage() {
    try {
      if (typeof applyLibraryLayout === "function") applyLibraryLayout();
      if (typeof carregarHistorico === "function") carregarHistorico();
      if (typeof renderLibrary === "function") renderLibrary();
      if (typeof renderDashboard === "function") renderDashboard();
      if (typeof inicializarControlesSegmentados === "function") inicializarControlesSegmentados();
      if (typeof atualizarNotificacaoApp === "function" && typeof obterContadorRascunhos === "function") {
        atualizarNotificacaoApp(obterContadorRascunhos());
      }
    } catch (error) {
      console.error("Erro ao atualizar interface após sincronização:", error);
    }
  }

  function setAuthUi(message) {
    const loggedOutSection = document.getElementById("account-logged-out");
    const loggedInSection = document.getElementById("account-logged-in");
    const accountName = document.getElementById("account-user-name");
    const accountEmail = document.getElementById("account-user-email");
    const accountAvatar = document.getElementById("account-user-avatar");
    const accountStatus = document.getElementById("account-sync-status");
    const navAvatar = document.getElementById("nav-account-avatar");
    const navIcon = document.getElementById("nav-account-icon");
    const lastSyncEl = document.getElementById("account-last-sync");

    const button = document.getElementById("auth-button");
    const status = document.getElementById("auth-status");
    const avatar = document.getElementById("auth-avatar");

    if (status) status.textContent = message || "";
    if (accountStatus) {
      accountStatus.textContent = message || (state.user ? "conectado à nuvem" : "");
    }

    if (lastSyncEl) {
      const lastSync = localStorage.getItem(STORAGE.lastSync);
      if (lastSync) {
        try {
          const d = new Date(lastSync);
          lastSyncEl.textContent = `última sincronização: ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
        } catch (_) {
          lastSyncEl.textContent = "";
        }
      } else {
        lastSyncEl.textContent = "";
      }
    }

    if (!isConfigured) {
      if (loggedOutSection) loggedOutSection.style.display = "block";
      if (loggedInSection) loggedInSection.style.display = "none";
      if (button) {
        button.textContent = "configurar nuvem";
        button.disabled = true;
        button.title = "Preencha supabase-config.js primeiro";
      }
      if (avatar) avatar.style.display = "none";
      if (navAvatar && navIcon) {
        navAvatar.style.display = "none";
        navIcon.style.display = "block";
      }
      return;
    }

    if (state.user) {
      if (loggedOutSection) loggedOutSection.style.display = "none";
      if (loggedInSection) loggedInSection.style.display = "block";

      const name = state.user.user_metadata?.full_name || state.user.user_metadata?.name || state.user.email || "Usuário";
      const email = state.user.email || "";
      const avatarUrl = state.user.user_metadata?.avatar_url;

      if (accountName) accountName.textContent = name;
      if (accountEmail) accountEmail.textContent = email;

      if (accountAvatar) {
        if (avatarUrl) {
          accountAvatar.src = avatarUrl;
          accountAvatar.style.display = "block";
        } else {
          accountAvatar.style.display = "none";
        }
      }

      if (navAvatar && navIcon) {
        if (avatarUrl) {
          navAvatar.src = avatarUrl;
          navAvatar.style.display = "block";
          navIcon.style.display = "none";
        } else {
          navAvatar.style.display = "none";
          navIcon.style.display = "block";
        }
      }

      if (button) {
        button.textContent = name;
        button.title = `${email} — clique para sair`;
      }
      if (avatar && avatarUrl) {
        avatar.src = avatarUrl;
        avatar.style.display = "block";
      } else if (avatar) {
        avatar.style.display = "none";
      }
    } else {
      if (loggedOutSection) loggedOutSection.style.display = "block";
      if (loggedInSection) loggedInSection.style.display = "none";

      if (navAvatar && navIcon) {
        navAvatar.style.display = "none";
        navIcon.style.display = "block";
      }

      if (button) {
        button.disabled = false;
        button.title = "Sincronizar suas reviews entre dispositivos";
      }
      if (avatar) avatar.style.display = "none";
    }
  }

  async function fetchCloudRow() {
    const { data, error } = await state.client
      .from("loopd_user_data")
      .select("reviews, settings, schema_version, updated_at")
      .eq("user_id", state.user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function uploadNow() {
    if (!state.user || state.syncing || state.applyingCloud) return;

    state.syncing = true;
    setAuthUi("sincronizando...");

    try {
      const payload = {
        user_id: state.user.id,
        reviews: getLocalReviews(),
        settings: getLocalSettings(),
        schema_version: 1,
        updated_at: new Date().toISOString(),
      };

      const { error } = await state.client
        .from("loopd_user_data")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;
      localStorage.setItem(STORAGE.associatedUser, state.user.id);
      localStorage.setItem(STORAGE.lastSync, payload.updated_at);
      setAuthUi("salvo na nuvem");
    } catch (error) {
      console.error("Erro ao sincronizar Loopd:", error);
      setAuthUi("erro ao sincronizar — dados locais preservados");
    } finally {
      state.syncing = false;
      setTimeout(() => setAuthUi(""), 1600);
    }
  }

  function scheduleSync(delay = 1200) {
    if (!state.user || state.applyingCloud) return;
    clearTimeout(state.syncTimer);
    state.syncTimer = setTimeout(uploadNow, delay);
  }

  async function reconcileAfterLogin() {
    const localReviews = getLocalReviews();
    const localSettings = getLocalSettings();
    const associatedUser = localStorage.getItem(STORAGE.associatedUser);
    const cloud = await fetchCloudRow();

    // Mesmo usuário neste navegador: a nuvem é a fonte de verdade ao iniciar a sessão.
    if (associatedUser === state.user.id) {
      if (cloud) {
        setLocalData(cloud.reviews, cloud.settings);
        refreshAppFromStorage();
      } else {
        await uploadNow();
      }
      return;
    }

    // Outro usuário já usou este navegador: nunca misture os dados dele com a conta atual.
    if (associatedUser && associatedUser !== state.user.id) {
      if (cloud) {
        setLocalData(cloud.reviews, cloud.settings);
      } else {
        setLocalData([], {});
      }
      localStorage.setItem(STORAGE.associatedUser, state.user.id);
      refreshAppFromStorage();
      if (!cloud) await uploadNow();
      return;
    }

    // Primeira associação deste navegador. Preserva o acervo legado do LocalStorage.
    if (!cloud) {
      localStorage.setItem(STORAGE.associatedUser, state.user.id);
      await uploadNow();
      return;
    }

    if (localReviews.length === 0) {
      setLocalData(cloud.reviews, cloud.settings);
    } else {
      const mergedReviews = mergeLegacyReviews(cloud.reviews || [], localReviews);
      const mergedSettings = { ...(cloud.settings || {}), ...localSettings };
      setLocalData(mergedReviews, mergedSettings);
    }

    localStorage.setItem(STORAGE.associatedUser, state.user.id);
    refreshAppFromStorage();
    await uploadNow();
  }

  async function loginWithGoogle() {
    if (!state.client) return;
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await state.client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      console.error("Erro no login com Google:", error);
      alert("não foi possível entrar com o Google. verifique a configuração do Supabase.");
    }
  }

  async function logout() {
    if (!state.client) return;
    clearTimeout(state.syncTimer);
    await uploadNow();
    const { error } = await state.client.auth.signOut();
    if (error) console.error("Erro ao sair:", error);
  }

  async function toggleAuth() {
    if (!isConfigured) return;
    if (state.user) {
      const shouldLogout = confirm("deseja sair da sua conta? os dados já sincronizados continuarão salvos na nuvem.");
      if (shouldLogout) await logout();
    } else {
      await loginWithGoogle();
    }
  }

  async function init() {
    if (state.initialized) return;
    state.initialized = true;

    if (!isConfigured) {
      setAuthUi("preencha supabase-config.js para ativar a sincronização");
      return;
    }

    if (!window.supabase?.createClient) {
      console.error("Biblioteca Supabase não carregou.");
      setAuthUi("erro ao carregar Supabase");
      return;
    }

    state.client = window.supabase.createClient(CONFIG.url, CONFIG.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    const { data: { session } } = await state.client.auth.getSession();
    state.user = session?.user || null;
    setAuthUi("");

    if (state.user) {
      try {
        await reconcileAfterLogin();
      } catch (error) {
        console.error("Erro ao carregar dados da nuvem:", error);
        setAuthUi("erro ao carregar nuvem — dados locais preservados");
      }
    }

    state.client.auth.onAuthStateChange(async (event, sessionNow) => {
      const previousUserId = state.user?.id;
      state.user = sessionNow?.user || null;
      setAuthUi("");

      if (state.user && state.user.id !== previousUserId && event === "SIGNED_IN") {
        try {
          await reconcileAfterLogin();
        } catch (error) {
          console.error("Erro ao sincronizar após login:", error);
          setAuthUi("erro ao carregar nuvem — dados locais preservados");
        }
      }
    });
  }

  window.loopdCloud = {
    init,
    toggleAuth,
    scheduleSync,
    uploadNow,
    refreshUi: () => setAuthUi(""),
    getUser: () => state.user,
  };

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("online", () => scheduleSync(250));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") uploadNow();
  });
})();
