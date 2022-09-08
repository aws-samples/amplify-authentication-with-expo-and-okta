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

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as Infra from '../lib/infra-stack';

const app = new cdk.App();
const stack = new Infra.InfraStack(app, 'MyTestStack');
const template = Template.fromStack(stack);

test('All resources for stack present', () => {
    template.resourceCountIs('AWS::S3::Bucket', 2)
    template.resourceCountIs('Custom::AWSCDKOpenIdConnectProvider', 1)
    template.resourceCountIs('AWS::Cognito::IdentityPool', 1)
    template.resourceCountIs('AWS::IAM::Role', 3)

});

test('Check S3 Buckets are properly secured', () => {
    const properlySecuredBuckets = template.findResources('AWS::S3::Bucket', {
        Properties: Match.objectLike({
                PublicAccessBlockConfiguration: {
                    "BlockPublicAcls": true,
                    "BlockPublicPolicy": true,
                    "IgnorePublicAcls": true,
                    "RestrictPublicBuckets": true
                    },
                BucketEncryption: {
                    "ServerSideEncryptionConfiguration": [
                        {
                        "ServerSideEncryptionByDefault": { "SSEAlgorithm": "AES256" }
                        }
                    ]
                }
            })
        });

    expect(Object.keys(properlySecuredBuckets)).toHaveLength(2);
})

test('Identity Pool Authenticated Role exists and has the correct policy permission', () => {
    const IpoolAuthenticatedRole = template.findResources('AWS::IAM::Role', {
        Properties: {
            AssumeRolePolicyDocument: Match.objectLike({
                Statement: [{
                    Action: 'sts:AssumeRoleWithWebIdentity',
                    Effect: 'Allow',
                    Principal: { Federated: 'cognito-identity.amazonaws.com' },
                    Condition: {     
                        'ForAnyValue:StringLike': {
                            'cognito-identity.amazonaws.com:amr': 'authenticated',
                            },
                        }
                }],
            }
            )
        }
    })

    expect(Object.keys(IpoolAuthenticatedRole)).toHaveLength(1);
    const resolvedIpoolAuthenticatedRoleName = Object.keys(IpoolAuthenticatedRole)[0];

    template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
            Statement: [{
                Action: [
                    "s3:GetObject",
                    "s3:ListBucket"
                    ],
                Effect: "Allow",
            }]
            },
            Roles: [{
            Ref: resolvedIpoolAuthenticatedRoleName
        }]
    })
})