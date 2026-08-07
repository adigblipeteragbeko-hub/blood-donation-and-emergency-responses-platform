import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';

const controller = readFileSync('src/modules/assistant/assistant.controller.ts', 'utf8');
const service = readFileSync('src/modules/assistant/assistant.service.ts', 'utf8');
const navigation = readFileSync('src/modules/assistant/assistant-navigation.service.ts', 'utf8');
const intent = readFileSync('src/modules/assistant/assistant-intent.service.ts', 'utf8');
const query = readFileSync('src/modules/assistant/assistant-query.service.ts', 'utf8');
const faq = readFileSync('src/modules/assistant/knowledge/public-faq.ts', 'utf8');
const schema = readFileSync('prisma/schema.prisma', 'utf8');

describe('BloodSOS Assistant static safety', () => {
  it('keeps the active role model to exactly three application roles', () => {
    expect(schema).toContain('ADMIN');
    expect(schema).toContain('DONOR');
    expect(schema).toContain('HOSPITAL_ADMIN');
    expect(service).not.toContain('SUPER_ADMIN');
    expect(navigation).not.toContain('HOSPITAL_STAFF');
  });

  it('separates public and authenticated endpoints with throttling', () => {
    expect(controller).toContain("Post('public/message')");
    expect(controller).toContain("Post('message')");
    expect(controller).toContain('JwtAccessGuard');
    expect(controller).toContain('ThrottlerGuard');
    expect(controller).toContain('limit: 20');
    expect(controller).toContain('limit: 60');
  });

  it('blocks public access to private operational intents', () => {
    expect(service).toContain('publicMessage');
    expect(service).toContain('isPrivateIntent');
    expect(service).toContain('Please sign in with the appropriate account');
  });

  it('uses role-specific route allowlists and blocks arbitrary urls', () => {
    expect(navigation).toContain('routeAllowlist');
    expect(navigation).toContain('/hospital/stock-intelligence');
    expect(navigation).toContain('/admin/management?section=donor-communications');
    expect(navigation).not.toContain('http://');
  });

  it('contains deterministic intent detection and unsupported topic refusal', () => {
    expect(intent).toContain('UNSUPPORTED_TOPIC');
    expect(intent).toContain('diagnose');
    expect(intent).toContain('normalize(message: string)');
    expect(intent).toContain('appoinment');
    expect(intent).toContain('eligiblity');
    expect(intent).toContain('inventry');
    expect(intent).toContain('matchedGroup');
    expect(service).toContain('cannot diagnose');
    expect(service).toContain('not a general-purpose');
    expect(service).toContain('I could not fully match that question');
    expect(service).toContain('I could not retrieve that information right now');
  });

  it('scopes donor and hospital queries to the current authenticated user', () => {
    expect(query).toContain('findUnique({ where: { userId } })');
    expect(query).toContain('getHospitalForUser(userId)');
    expect(query).toContain('hospitalId: hospital.id');
    expect(query).not.toContain('phone');
  });

  it('stores conservative public knowledge base answers', () => {
    expect(faq).toContain('Blood donation is generally safe');
    expect(faq).toContain('not a medical diagnosis');
    expect(faq).toContain('transfusion decisions require clinical crossmatching');
  });
});
