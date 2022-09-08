/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import React, { useState } from 'react';

import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';

import { useAutoDiscovery, useAuthRequest, makeRedirectUri, exchangeCodeAsync, } from 'expo-auth-session';  
import { maybeCompleteAuthSession } from 'expo-web-browser';

import axios from 'axios'
import Amplify, {Auth, Storage} from'aws-amplify';
import S3 from 'aws-sdk/clients/s3';
// for readability the Okta and Amplify configs have been split into separate files
import amplifyConfig from './config/aws-exports.json';
import oktaConfig from './config/okta-config.json';

Amplify.configure(amplifyConfig);
Auth.configure(amplifyConfig);
Storage.configure(amplifyConfig);

function callToS3(resultCallback) {
  // use credentials from Auth to create an authenticated S3 client
  // calls to the SDK must happen within the scope of the function
  Auth.currentCredentials().then((credentials) => {

    const s3client = new S3({
      apiVersion: '2006-03-01',
      credentials: Auth.essentialCredentials(credentials),
    });
  
    const params = { 
      Bucket: amplifyConfig.Storage.AWSS3.bucket,
      Delimiter: '',
      Prefix: '' 
    }
    
    s3client.listObjects(params, function (err, data) {
      if(err)throw err;
      resultCallback(JSON.stringify(data.Contents, null, 2))
    });
  })
}

//After getting the Auth Code we need to exchange it for credentials
async function ExchangeForToken(response, authRequest, discovery) {
  // React hooks must be used within functions
  const useProxy = true;
  const expoRedirectURI = makeRedirectUri({
    native: oktaConfig.okta_callback_url,
    useProxy,
  })

  const tokenRequestParams = {
    code: response.params.code,
    clientId: oktaConfig.okta_client_id,
    redirectUri: expoRedirectURI,
    extraParams: {
      code_verifier: authRequest.codeVerifier
    },
  }
  
  const tokenResult = await exchangeCodeAsync(
      tokenRequestParams,
      discovery
  )

  const creds = ExchangeForUser(tokenResult)

  const finalAuthResult = {
    token_res : tokenResult,
    user_creds : creds
  }
  console.log("Final Result: ", finalAuthResult)
}

async function ExchangeForUser(tokenResult) {
  const accessToken = tokenResult.accessToken;
  const idToken = tokenResult.idToken;

  //make an HTTP direct call to the Okta User Info endpoint of our domain
  const usersRequest = `${oktaConfig.okta_issuer_url}/v1/userinfo`
  const userPromise = await axios.get(usersRequest, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  //oktaDomainName must correspond exactly to the IAM provisioned OIDC provider
  const tempValue = oktaConfig.okta_issuer_url
  const tempArray = tempValue.split("https://");
  const oktaDomainName = tempArray[1];
  
  const response = await Auth.federatedSignIn(
    oktaDomainName,
    {token: idToken}, userPromise.data).then(credentials => {
    // If success, you will get the AWS credentials
      return Auth.currentAuthenticatedUser();
    }).then(user => {
        // If success, the user object you passed in Auth.federatedSignIn
        console.log(user);
    }).catch(e => {
        console.log(e)
    });

}

export default CognitoOktaAuth = (props) =>  {
    const useProxy = true;

    if (Platform.OS === 'web') {
        maybeCompleteAuthSession();
      }
  
    const discovery = useAutoDiscovery(oktaConfig.okta_issuer_url);
    
    // When promptAsync is invoked we will get back an Auth Code
    // This code can be exchanged for an Access/ID token as well as 
    // User Info by making calls to the respective endpoints

    const [authRequest, response, promptAsync] = useAuthRequest(
      {
      clientId: oktaConfig.okta_client_id,
      scopes: ['openid', 'profile'],
      redirectUri: makeRedirectUri({
          native: oktaConfig.okta_callback_url,
          useProxy,
      }),
      },
      discovery
    );

    const [debugState, setDebugState] = useState();

    async function callAWSSDK (){
      callToS3(function(s3Result){
        setDebugState(JSON.parse(s3Result))
      })
    }

    async function oktaCognitoLogin (){
      const loginResult = await promptAsync({ useProxy });
      ExchangeForToken(loginResult, authRequest, discovery)
    }
  
    return (
      <View style={styles.container}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.equalSizeButtons}
            onPress={() => oktaCognitoLogin()}
          >
            <Text style={styles.buttonText}>Okta Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.equalSizeButtons}
            onPress={() => callAWSSDK()}
          >
            <Text style={styles.buttonText}>AWS SDK Call</Text>
          </TouchableOpacity>
        </View>
        <ScrollView>
          {response && <Text>{JSON.stringify(response, null, 2)}</Text>}     
          {<Text>{JSON.stringify(debugState, null, 2)}</Text>}
        </ScrollView>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: {
      margin: 10,
      marginTop: 20
    },
    buttonContainer: {
        flexDirection: "row",
        alignItems:'center',
        margin: 5
      },
    equalSizeButtons: {
      width: '50%',
      backgroundColor: "#023788",
      borderColor: "#6df1d8",
      flexDirection: "row",
      justifyContent: 'center',
      alignItems: 'center',
      padding: 9,
      borderWidth: 1,
      shadowColor: "#6df1d8",
      shadowOpacity: 8,
      shadowRadius: 3,
      shadowOffset: {
        height: 0,
        width: 0
      }
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 16
    }
  })