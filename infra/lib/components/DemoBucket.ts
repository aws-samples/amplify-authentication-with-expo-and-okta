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

import * as s3 from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from "cdk-nag";
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { s3Props } from '../infra-stack';

export default class DemoBucket extends Construct {

    constructor(scope: Construct, id: string, props: s3Props) {
        super(scope, id);

    const logs_bucket = new s3.Bucket(this, props.logsBucketName, { 
        versioned: true,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        encryption: s3.BucketEncryption.S3_MANAGED
    });
    // prevents infinite dependency for server logs buckets
    NagSuppressions.addResourceSuppressions(logs_bucket, [
        {
        id: "AwsSolutions-S1",
        reason:
            "Server Access Logs Bucket doesn't need a Server Access Logs Bucket",
        },
    ]);

    const bucket = new s3.Bucket(this, props.bucketName, { 
        versioned: true,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
        serverAccessLogsBucket: logs_bucket });

        //grant authenticated users permission to access S3
        const authIdentityPerms = new iam.PolicyStatement({
            resources: [
              `arn:aws:s3:::${bucket.bucketName}/*`,
              `arn:aws:s3:::${bucket.bucketName}`
            ],
            actions: ['s3:GetObject', 's3:ListBucket'],
            effect: iam.Effect.ALLOW
          })
      
          props.identityPool.authenticatedRole.addToPrincipalPolicy(authIdentityPerms);
      
          NagSuppressions.addResourceSuppressions(
            props.identityPool.authenticatedRole, 
            [
              {
                id: "AwsSolutions-IAM5",
                reason:
                  "Items in bucket need to be accesible by AuthN users",
                appliesTo: [
                  {
                    regex: '/^Resource::arn:aws:s3:::(.*)/g'
                  },
                ]
              },
            ],
            true
          );
    }
}