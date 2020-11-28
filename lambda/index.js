/*
 * Copyright 2018-2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

// sets up dependencies
const Alexa = require('ask-sdk-core');
const i18n = require('i18next');
const languageStrings = require('./languageStrings');

var questionList = require('./question-list');
var persistenceAdapter = getPersistenceAdapter();
var currentIndex = null;
var currentStatus = null;
var hits = 0;
var count = 0;
var pending = null;
var userName = undefined;

const GIVEN_NAME_PERMISSION = ['alexa::profile::given_name::read'];

// Setea las variables 
function SetVariables() {
    delete require.cache[require.resolve('./question-list')];
    questionList = require('./question-list');
    currentIndex = null;
    currentStatus = null;
    hits = 0;
    count = 0;
    pending = null;
}



//Handlers

//Handler de invocación
const LaunchRequestHandler = { //Funcionando
 canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (request.type === 'LaunchRequest');
    
//LaunchRequest indica que es la petición de lanzamiento
 },
 async handle(handlerInput) { 
 //const speakOutput = "Bienvenido a 'En qué año Pasó' ";
    SetVariables();
    const questionText = getQuestion();
    const { attributesManager, serviceClientFactory, requestEnvelope } = handlerInput;

    try {
        const {permissions} = requestEnvelope.context.System.user;
        if (!permissions)
            throw { statusCode: 401, message: 'No hay permisos' };
        const upsServiceClient = serviceClientFactory.getUpsServiceClient();
        const profileName = await upsServiceClient.getProfileGivenName();
        userName = (profileName ? profileName : '');
        
    } catch (error) {
        console.log(JSON.stringify(error));
        if (error.statusCode === 401 || error.statusCode === 403) {
            handlerInput.responseBuilder.withAskForPermissionsConsentCard(GIVEN_NAME_PERMISSION);
         }
    }
    
    const speakOutput = "Bienvenido al juego más divertido " + userName + ", empecemos. " + questionText;
    currentStatus = 'Question';
    return handlerInput.responseBuilder
        .speak(speakOutput) //responde y
        .reprompt(speakOutput) //se queda esperando una respuesta
        .getResponse();
 },
};



// Obtiene un objeto random del arreglo que se le pasa
function getRandomItem(obj) {
    if (Object.keys(obj).length === 0) {
        return null;
    }
    
    currentIndex = obj[Object.keys(obj)[Math.floor(Math.random() * Object.keys(obj).length)]];
    return currentIndex;
}

function getQuestion(random = true) {
  let speechText = '';
  if (random) {
    speechText = getRandomItem(questionList);
    if (currentIndex === null && pending === null) {
        // Se acaba el juego
        return 'Ya respondiste las preguntas!... Has acertado ' + hits + ' de ' + count + ' preguntas. ';
    } else if (currentIndex === null) {
        currentIndex = pending;
        pending = null;
      return 'Ya no te quedan más preguntas nuevas, pero sí te queda una pendiente, vamos a por ella. ¿En que año ' + currentIndex.question + '?';
    }
    delete questionList[currentIndex.id];
    count++;
  } else {
    speechText = currentIndex;
  }
  const speakOutput = '¿En qué año ' + speechText.question + '?';
  return speakOutput;
}



const AnswerIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return (request.type === 'IntentRequest' 
          && request.intent.name === 'AnswerIntent');
    }, 
    
    handle(handlerInput) {
        const AnswerValue = handlerInput.requestEnvelope.request.intent.slots.numberSlot.value;
        //let speakOutput = "Respondiste " + AnswerValue;
        let speakOutput = '';
        if (currentStatus === "Continue") {
            speakOutput += "Responde sí o no";
        } else {
            if (AnswerValue === currentIndex.year) {
                speakOutput += 'Respuesta correcta. ' + currentIndex.answer;
                hits++;
            } else {
                speakOutput += 'Respuesta incorrecta. El año correcto es ' + currentIndex.year + ' porque ' + currentIndex.answer;
            }
        }
        currentIndex = null;
        speakOutput += "... Continuamos? ";
        currentStatus = 'Continue';
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};



const YesIntentHandler = { //Funcionando
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    
    handle(handlerInput) {
        let speakOutput = getQuestion();
        
        if (currentIndex === null) { // No hay más preguntas
           
            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
            let highestHits = sessionAttributes['highestHits'];
            if (typeof(highestHits) !== "undefined") {
                if (hits === highestHits) {
                    speakOutput += "Wao! Has igualado la mejor puntuación hasta ahora. ";
                } else if (hits < highestHits) {
                    speakOutput += "Vaya! Te has quedado a " + (highestHits - hits) + " acierto" + (highestHits - hits > 1 ? "s" : "") + " del primer lugar! "; 
                } else {
                    speakOutput += "Felicidades! Has conseguido un nuevo récord. ";
                    sessionAttributes['highestHits'] = hits;
                }
            } else { //por qué no entra si pongo if (typeof(highestHits) === "undefined" || highestHits < hits)
                speakOutput += "Felicidades! Has conseguido un nuevo récord. ";
                sessionAttributes['highestHits'] = hits;
            }
            speakOutput += "Hasta luego! ";
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .withShouldEndSession(true) // NO está cerrando la sesión bien
                .getResponse();
        }
    
        currentStatus = 'Question';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};


const ClueIntentHandler = { //Funcionando
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'ClueIntent';
  },
  
  
    handle(handlerInput) {
        let speakOutput = '';
        if (currentStatus === 'Question') {
            speakOutput = 'Ahí va la pista. ' + currentIndex.clue + '. Te la vuelvo a preguntar. ' + getQuestion(false);
        } else if (currentStatus === 'Continue') {
            speakOutput += 'Responde Sí o No.';
        }
      
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
  }
};


const RepeatIntentHandler = { //Funcionando. Después de haber quitado el Alexa.get...
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.RepeatIntent';
  },
  
  handle(handlerInput) {
      let speakOutput = '';
      if (currentStatus === 'Question') {
          speakOutput = 'Repetimos!... ' + getQuestion(false);
      } else if (currentStatus === 'Continue') {
          speakOutput += 'Continuamos?';
      }
      
      return handlerInput.responseBuilder
          .speak(speakOutput)
          .reprompt(speakOutput)
          .getResponse();
  }
};


const NextIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.NextIntent';
  },
  
  
  handle(handlerInput) {
      let speakOutput = '';
      if (pending !== null) {
          speakOutput = 'Solo puedes tener una pregunta pendiente por responder. Vamos a por ella de nuevo... ';
          const tmpIndex = pending;
          currentIndex = pending;
          pending = tmpIndex;
          speakOutput += getQuestion(false);
      } else {
          speakOutput += 'Guardamos esta pregunta para después, vamos con la siguiente!...';
          pending = currentIndex;
          speakOutput += getQuestion();
      }
      
      
      currentStatus = 'Question';
      return handlerInput.responseBuilder
          .speak(speakOutput)
          .reprompt(speakOutput)
          .getResponse();
  }
};






const PendingIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'PendingIntent';
  },
  
    handle(handlerInput) {
        let speakOutput='';
        
        if (pending === null){
            if (currentIndex !== null && currentStatus === 'Question'){
                speakOutput += 'Hemos dejado esta pregunta sin responder, la guardamos para despues ...'
                pending = currentIndex;
            } 
            speakOutput += 'No tienes preguntas pendientes! ... Quieres continuar con una pregunta? ';
            currentStatus = 'Continue';
        } else {
            if(currentIndex !== null && currentStatus === 'Question'){
                let tmpIndex = currentIndex;
                currentIndex = pending;
                pending = tmpIndex;
                speakOutput += 'Hemos dejado esta pregunta sin responder, la guardamos para despues ...';
            } else {
                currentIndex = pending;
                pending = null;
            }

            speakOutput += 'Vamos con la pregunta que teníamos pendiente! ... '+ getQuestion(false);
            currentStatus = 'Question';
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    } 
};



// Persistencia
const ResetHighestScoreIntentHandler = {
    canHandle(handlerInput) {
        const {request} = handlerInput.requestEnvelope;
        return request.type === 'IntentRequest' && request.intent.name === 'ResetHighestScoreIntent';
    },
    
    handle(handlerInput) {
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes['highestHits'] = 0;
        
        let speakOutput = "Se ha restablecido el puntaje máximo a cero..."; 
        
        if (currentStatus === 'Question' && currentIndex !== null) {
            speakOutput += " Sigamos. " + getQuestion(false);
        } else {
            speakOutput += " Continuamos? ";
            currentStatus = "Continue";
        }
        


        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

function getPersistenceAdapter() {
    const  tableName = 'highscores_table'; // Mayores puntajes
    const {S3PersistenceAdapter} = require('ask-sdk-s3-persistence-adapter');
    return new S3PersistenceAdapter({
        bucketName: process.env.S3_PERSISTENCE_BUCKET
    });
}

const LoadAttributesRequestInterceptor = {
    async process(handlerInput) {
        if (handlerInput.requestEnvelope.session['new']) {
            const {attributesManager} = handlerInput;
            const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
            handlerInput.attributesManager.setSessionAttributes(persistentAttributes);
        }
    }
};

const SaveAttributesResponseInterceptor = {
    async process(handlerInput, response) {
        const {attributesManager} = handlerInput;
        const sessionAttributes = attributesManager.getSessionAttributes();
        const shouldEndSession = (typeof response.shouldEndSession === "undefined" ? true : response.shouldEndSession);
        if (shouldEndSession || handlerInput.requestEnvelope.request.type === "SessionEndedRequest") {
            attributesManager.setPersistentAttributes(sessionAttributes);
            await attributesManager.savePersistentAttributes();
            
        }
    }
};















// core functionality for fact skill

const HelpHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    return handlerInput.responseBuilder
      .speak(requestAttributes.t('HELP_MESSAGE'))
      .reprompt(requestAttributes.t('HELP_REPROMPT'))
      .getResponse();
  },
};

const FallbackHandler = {
  // The FallbackIntent can only be sent in those locales which support it,
  // so this handler will always be skipped in locales where it is not supported.
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && request.intent.name === 'AMAZON.FallbackIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    return handlerInput.responseBuilder
      .speak(requestAttributes.t('FALLBACK_MESSAGE'))
      .reprompt(requestAttributes.t('FALLBACK_REPROMPT'))
      .getResponse();
  },
};

const ExitHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request.intent.name === 'AMAZON.CancelIntent'
        || request.intent.name === 'AMAZON.NoIntent'
        || request.intent.name === 'AMAZON.StopIntent'
        || (currentIndex === null && pending === null));// cerrar al acabar
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    let highestHits = sessionAttributes['highestHits'];
    let speakOutput = 'Has conseguido acertar ' + hits + ' de ' + count + ' preguntas. ';
    
    if (typeof(highestHits) !== "undefined") {
        if (hits === highestHits) {
            speakOutput += "Wao! Has igualado la mejor puntuación hasta ahora. ";
        } else if (hits < highestHits) {
            speakOutput += "Vaya! Te has quedado a " + (highestHits - hits) + " acierto" + (highestHits - hits > 1 ? "s" : "") + " del primer lugar! "; 
        } else {
            speakOutput += "Felicidades! Has conseguido un nuevo récord. ";
            sessionAttributes['highestHits'] = hits;    
        }
    } else {
        speakOutput += "Felicidades! Obtuviste el mejor puntaje hasta ahora. ";
        sessionAttributes['highestHits'] = hits;
    }
    
    speakOutput += "Hasta luego! ";
    
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .withShouldEndSession(true)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
    return handlerInput.responseBuilder
        .withShouldEndSession(true)
        .getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    //const speakOutput = 'Perdon, hay un error, inténtalo otra vez';
    //.speak(speakOutput) // En caso de error 
    console.log(`Error handled: ${error.message}`);
    console.log(`Error stack: ${error.stack}`);
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    return handlerInput.responseBuilder
      .speak(requestAttributes.t('ERROR_MESSAGE'))
      .reprompt(requestAttributes.t('ERROR_MESSAGE'))
      .getResponse();
  },
};




// Interceptores
const LocalizationInterceptor = {
  process(handlerInput) {
    // Gets the locale from the request and initializes i18next.
    const localizationClient = i18n.init({
      lng: handlerInput.requestEnvelope.request.locale,
      resources: languageStrings,
      returnObjects: true
    });
    // Creates a localize function to support arguments.
    localizationClient.localize = function localize() {
      // gets arguments through and passes them to
      // i18next using sprintf to replace string placeholders
      // with arguments.
      const args = arguments;
      const value = i18n.t(...args);
      // If an array is used then a random value is selected
      if (Array.isArray(value)) {
        return value[Math.floor(Math.random() * value.length)];
      }
      return value;
    };
    // this gets the request attributes and save the localize function inside
    // it to be used in a handler by calling requestAttributes.t(STRING_ID, [args...])
    const attributes = handlerInput.attributesManager.getRequestAttributes();
    attributes.t = function translate(...args) {
      return localizationClient.localize(...args);
    }
  }
};

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    AnswerIntentHandler,
    YesIntentHandler,
    ClueIntentHandler,
    RepeatIntentHandler,
    NextIntentHandler,
    PendingIntentHandler,
    ResetHighestScoreIntentHandler,
    HelpHandler,
    ExitHandler,
    FallbackHandler,
    SessionEndedRequestHandler,
  )
  .addRequestInterceptors(
    LocalizationInterceptor,
    LoadAttributesRequestInterceptor          
  )
  .addResponseInterceptors(
    SaveAttributesResponseInterceptor
  )
  .withPersistenceAdapter(persistenceAdapter)
  .addErrorHandlers(ErrorHandler)
  .withCustomUserAgent('sample/basic-fact/v2')
  .withApiClient(new Alexa.DefaultApiClient())
  .lambda();
