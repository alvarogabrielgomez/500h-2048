
/**
 * Class to manage all the requests to the API
 * @param {string} jwt - JWT of the user
 * @param {string} url - URL of the API
 * @returns {object} - Object with all the methods
 *
 * @example
 * const sar = new SarLib("jwt","url");
 * sar.getAllAvaliableChallenges();
 * sar.addStep();
 * sar.finishChallenge();
 * sar.getAllChallenges();
 * sar.getActiveChallengeUser();
 *
 */

class SarLib {
  constructor({uuid, secretKey}, url) {
    this.initialized = false;
    this.secretKey = secretKey;
    this.challengeUUID = uuid;
    this.queryParams = [];
    this.urlApi = url || "https://500h-sar-dev.accentiostudios.com";
    this.user = null;
    this.testMode;
  }

  async init(callback) {
    try {
      let context = this;
      this.createLoadingScreen();
      this.removeErrorScreen();
      this.parseQueryParams();
      const testMode = this.getQueryParam("testMode") === 'true';
      this.testMode = testMode;

      setTimeout(async () => {
        const responses = await Promise.all([
          this.getUser(),
        ]).catch(error => {
          this.createErrorScreen(error.message);
          throw error;
        });
          this.initialized = true;
          this.removeLoadingScreen();
          callback(this.user);
      }, 2000);
    } catch(error) {
      this.createErrorScreen('Error al inicializar. Carga nuevamente el juego.');
      throw error;
    }
  }

  
  parseQueryParams() {
    const searchParams = new URLSearchParams(window.location.search);
    for (const [key, value] of searchParams) {
        this.queryParams[encodeURIComponent(key)] = encodeURIComponent(value);
      }
    }
    
    getQueryParam(paramName) {
      const paramValue = this.queryParams[encodeURIComponent(paramName)];
      if (paramValue !== null) {
        return encodeURIComponent(paramValue);
      }
      return '';
    }
    
    
    /**
    * Metodo para obtener todos los el usuario
     @returns User
    */
    async getUser() {
      try {
        const userId = this.getQueryParam("userId");
        let myHeaders = new Headers();
        myHeaders.append("sar-secret-key", this.secretKey);
        myHeaders.append("sar-challenge-uuid", this.challengeUUID);
        myHeaders.append("sar-test-mode", this.testMode.toString());
        var requestOptions = {
          method: 'GET',
          headers: myHeaders,
          redirect: 'follow'
        };
        const response = await fetch(`${this.urlApi}/v1/challenge/user?id=${userId}`, requestOptions);
        if(response) {
          if(response.ok) {
              const data = await response.json();
              this.user = data;
              return data;
          } else {
            this.toaster('Status Code: ' + response.status)
            throw new Error('Error en la respuesta del servidor.');
          }
        }
      } catch(error) {
        if(error instanceof Error) {
          throw error;
        }
        throw new Error('Error al obtener informacion del usuario al inicializar.');
      }
    }

    //     /**
    // * Metodo para obtener todos los el usuario
    //  @returns User
    // */
    //  async getUser() {
    //   const userId = this.getQueryParam("userId");
    //   const response = await this.getFetch(`/v1/challenge/user?id=${userId}`, {
    //     method: 'GET',
    //   });
    //   return response;
    // }

      /**
   * Method to get add a step to an unfinished challenge
   * @returns object
   */
  addStep() {
    
    this.retryIfNotDone(async () => {
      const response = await fetch(`${this.urlApi}/v1/challenge/add-step`);
      const data = await response.json();
      return data;
    });
  }

  closeWebView(success) {
    if(window.messageHandler) {
      window.messageHandler.postMessage(success);
      window.close();
    }
  }


  /**
   * Method to finish challenge
   * @returns object
   */
  async finishChallenge(success) {
    var isMobile = this.getQueryParam('isMobile') === 'true';
    try {
      this.createLoadingScreen();
      await this.sendRequest('/v1/challenge/finish', {
        method: 'POST',
        body: {
          userId: this.user.id,
          uuid: this.challengeUUID,
          success: success
        }
      });
      this.createSuccessScreen(success);
      this.removeLoadingScreen();
      // wait 2 seconds for close the web view
      await new Promise(resolve => setTimeout(() => {
        this.closeWebView(success);
        resolve();
      }, 2000));
    } catch (error) {
      this.removeLoadingScreen();
      // this.createErrorScreen(error.message);
      throw error;
    }
  }

  async retryIfNotDone(func) {
    this.removeErrorScreen();
    let count = 0;
    while (count < 3) {
      const result = await func();
      if (this.initialized === true) {
        return result;
      } else {
        count++;
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    this.createErrorScreen('Se ha intentado 3 veces y no se ha podido realizar la operación');
    throw new Error('Se ha intentado 3 veces y no se ha podido realizar la operación');
  }

  async sendRequest(endpoint, options = {}) {
    const urlApi = this.urlApi;
    this.removeErrorScreen();

    const headers = {
      'Content-Type': 'application/json',
      'sar-challenge-uuid': this.challengeUUID,
      'sar-secret-key': this.secretKey,
      'sar-test-mode': this.testMode?.toString()
    };

    const requestOptions = {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : null,
    };

    let data = null;

    await this.retryIfNotDone(async () => {
      try {
        const response = await fetch(urlApi + endpoint, requestOptions);
        if (response.ok) {
          data = await response.json();
        } else {
          throw new Error('Error en la respuesta del servidor.');
        }
      } catch (error) {
        this.toaster(error.message);
        throw new Error(error);
      }
    });

    return data;
  }

  createLoadingScreen() {
    const splashScreen = document.createElement('div');
    splashScreen.id = 'splashScreen';
    splashScreen.style.width = '100%';
    splashScreen.style.height = '100%';
    splashScreen.style.backgroundColor = '#101C29';
    splashScreen.style.position = 'fixed';
    splashScreen.style.top = '0';
    splashScreen.style.left = '0';
    splashScreen.style.display = 'flex';
    splashScreen.style.justifyContent = 'center';
    splashScreen.style.alignItems = 'center';
    splashScreen.style.zIndex = '10000000';
    // container flexible with centered image of gif and a text with loading message
    splashScreen.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; padding: 24px;">

        <img src="/images/sar_loading.gif" style="width: 180px; height: 180px;">
        <h1 style="color: white; font-size: 18px; margin-top: 18px;">Cargando...</h1>
      </div>
      
    `
    document.body.appendChild(splashScreen);
  }

  createSuccessScreen(win) {
    // first we remove all the content inside the #sar-game-app div
    const sarGameApp = document.getElementById('sar-game-app');
    sarGameApp.innerHTML = '';
    // then we create a div with the id successScreen
    const successScreen = document.createElement('div');
    successScreen.id = 'successScreen';
    successScreen.style.width = '100%';
    successScreen.style.height = '100%';
    successScreen.style.backgroundColor = '#101C29';
    successScreen.style.position = 'fixed';
    successScreen.style.top = '0';
    successScreen.style.left = '0';
    successScreen.style.display = 'flex';
    successScreen.style.justifyContent = 'center';
    successScreen.style.alignItems = 'center';
    successScreen.style.zIndex = '10000000';
    // container flexible with centered image of gif and a text with loading message
    successScreen.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; padding: 24px;">
  
        <h1 style="color: white; font-size: 18px; margin-top: 18px;">Game Over!</h1>
        <h3 style="color: white; font-size: 16px; margin-top: 0px; text-align:center; font-weight: 400;">${win === true ? 'Felicidades, has obtenido puntos gracias a ganar el juego. Sigue así' : 'Lamentablemente no has obtenido puntos esta vez, pero sigue intentando!'}</h3>
      </div>
      
    `
    document.body.appendChild(successScreen);
  }

  createErrorScreen(message) {
    this.removeErrorScreen();
    const errorScreen = document.createElement('div');
    errorScreen.id = 'errorScreen';
    errorScreen.style.width = '100%';
    errorScreen.style.height = '100%';
    errorScreen.style.backgroundColor = '#101C29';
    errorScreen.style.position = 'fixed';
    errorScreen.style.top = '0';
    errorScreen.style.left = '0';
    errorScreen.style.display = 'flex';
    errorScreen.style.justifyContent = 'center';
    errorScreen.style.alignItems = 'center';
    errorScreen.style.zIndex = '10000001';
    // container flexible with centered image of gif and a text with loading message
    errorScreen.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; padding: 24px;">

        <img src="/images/bug-error-image.svg" style="width: 120px; height: 120px;">
        <h1 style="color: white; font-size: 20px; margin-top: 24px; text-align:center;">Oops...</h1>
        <h3 style="color: white; font-size: 16px; margin-top: 0px; text-align:center; font-weight: 400;">${message}</h3>
      </div>
      
    `
    document.body.appendChild(errorScreen);
  }

  removeErrorScreen() {
    const errorScreen = document.querySelector('#errorScreen');
    if(errorScreen) {
      errorScreen.parentNode.removeChild(errorScreen);
    }
  }

  removeSuccessScreen() {
    const successScreen = document.querySelector('#successScreen');
    if(successScreen) {
      successScreen.parentNode.removeChild(successScreen);
    }
  }

  removeLoadingScreen() {
    const splashScreen = document.querySelector('#splashScreen');
    if(splashScreen) {
      splashScreen.parentNode.removeChild(splashScreen);
    }
  }

  toaster(message) {
    Toastify({
      text: message || "This is a toast",
      duration: 3000,
      newWindow: true,
      close: true,
      gravity: "top", // `top` or `bottom`
      position: "left", // `left`, `center` or `right`
      stopOnFocus: true, // Prevents dismissing of toast on hover
      style: {
        background: "#930006",
        color: "#FFDAD4",
      },
      onClick: function(){} // Callback after click
    }).showToast();
  }

}